import { z } from 'zod';
import { employmentTypeFromLabels } from '../../domain/employment.js';
import { makeJobId, type EmploymentType, type Job } from '../../domain/job.js';
import { remoteScopeFor } from '../../domain/remote-scope.js';
import type { Board } from '../board-source.js';
import {
  formatSalaryRange,
  normalizeTags,
  remoteIn,
  splitTitle,
  textOrNull,
  toIsoUtc,
} from '../normalize-helpers.js';
import { recruiteeOfferSchema, type RecruiteeOffer } from './schema.js';

/** Checked by prefix: "parttime_permanent" is part-time, though "permanent" alone reads as full-time. */
const EMPLOYMENT_PREFIXES: readonly (readonly [string, EmploymentType])[] = [
  ['fulltime', 'full_time'],
  ['parttime', 'part_time'],
  ['contract', 'contract'],
  ['temporary', 'contract'],
  ['freelance', 'freelance'],
  ['intern', 'internship'],
  ['trainee', 'internship'],
];

function employmentType(raw: RecruiteeOffer, title: string): EmploymentType {
  const code = raw.employment_type_code ?? '';
  const match = EMPLOYMENT_PREFIXES.find(([prefix]) => code.startsWith(prefix));
  return match ? match[1] : employmentTypeFromLabels([title]);
}

function toNumber(value: number | string | null | undefined): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return parsed !== undefined && parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

/** "2026-10-15 09:31:36 UTC" → ISO 8601. */
function recruiteeDate(value: string): string {
  return toIsoUtc(
    value
      .trim()
      .replace(' ', 'T')
      .replace(/\s*UTC$/i, ''),
  );
}

/** Remote offers say only "Remote job"; the countries people can work from are in `locations`. */
function locationText(raw: RecruiteeOffer, extra: string | null): string | null {
  if (!raw.remote) return textOrNull(raw.location) ?? extra;
  return remoteIn(
    (raw.locations ?? []).map((l) => l.country),
    extra ?? 'Remote',
  );
}

export function normalizeRecruiteeOffer(raw: RecruiteeOffer, board: Board): Job {
  const sourceJobId = `${board.board}:${String(raw.id)}`;
  const { title, extra } = splitTitle(raw.title);
  const location = locationText(raw, extra);
  const salary = raw.salary;
  return {
    id: makeJobId('recruitee', sourceJobId),
    source: 'recruitee',
    source_job_id: sourceJobId,
    url: raw.careers_url,
    title,
    company: board.company,
    location,
    // Hybrid counts as on-site, as with Lever and Ashby.
    remote_scope: remoteScopeFor(raw.remote === true, location, title),
    employment_type: employmentType(raw, title),
    salary: salary
      ? formatSalaryRange({
          min: toNumber(salary.min),
          max: toNumber(salary.max),
          currency: salary.currency,
          interval: salary.period ? `per ${salary.period}` : null,
        })
      : null,
    tags: normalizeTags([raw.department ?? '', ...(raw.tags ?? [])]),
    description: [
      raw.description ?? '',
      raw.requirements ? `<h3>Requirements</h3>\n${raw.requirements}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    published_at: recruiteeDate(raw.published_at ?? raw.created_at),
  };
}

export function normalizeRecruiteeResponse(payload: unknown, board: Board) {
  const { offers: rawOffers } = z.object({ offers: z.array(z.unknown()) }).parse(payload);
  const jobs: Job[] = [];
  for (const rawOffer of rawOffers) {
    const parsed = recruiteeOfferSchema.safeParse(rawOffer);
    if (!parsed.success) continue;
    try {
      jobs.push(normalizeRecruiteeOffer(parsed.data, board));
    } catch {
      // Unparseable date — skip the listing.
    }
  }
  return { jobs, skipped: rawOffers.length - jobs.length };
}
