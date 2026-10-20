import { z } from 'zod';
import { makeJobId, type EmploymentType, type Job } from '../../domain/job.js';
import { detectRegions, remoteScopeFor, scopeFromRegions } from '../../domain/remote-scope.js';
import type { Board } from '../board-source.js';
import { normalizeTags, splitTitle, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { ashbyJobSchema, type AshbyJob } from './schema.js';

const ADDRESS_REGION =
  /\b(?:european union|europe|emea|north america|latam|apac|worldwide|global)\b/i;

const EMPLOYMENT_TYPES: Record<string, EmploymentType> = {
  FullTime: 'full_time',
  PartTime: 'part_time',
  Intern: 'internship',
  Contract: 'contract',
  Temporary: 'contract',
};

export function normalizeAshbyJob(raw: AshbyJob, board: Board): Job {
  const sourceJobId = `${board.board}:${raw.id}`;
  const { title, extra } = splitTitle(raw.title);
  const location =
    textOrNull(
      [raw.location, ...(raw.secondaryLocations ?? []).map((secondary) => secondary.location)]
        .filter(Boolean)
        .join('; '),
    ) ?? extra;
  const isRemote = raw.workplaceType ? raw.workplaceType === 'Remote' : raw.isRemote === true;
  let scope = remoteScopeFor(isRemote, location, title);
  // Last resort: Ashby's address "country" is sometimes a region ("European Union"). A real
  // country there may just be the company's address, so only regions count.
  const addressCountry = raw.address?.postalAddress?.addressCountry ?? '';
  if (scope === 'Unknown' && ADDRESS_REGION.test(addressCountry)) {
    scope = scopeFromRegions(detectRegions(addressCountry));
  }

  return {
    id: makeJobId('ashby', sourceJobId),
    source: 'ashby',
    source_job_id: sourceJobId,
    url: raw.jobUrl,
    title,
    company: board.company,
    location,
    remote_scope: scope,
    employment_type: EMPLOYMENT_TYPES[raw.employmentType ?? ''] ?? 'unknown',
    salary:
      textOrNull(raw.compensation?.compensationTierSummary) ??
      textOrNull(raw.compensation?.scrapeableCompensationSalarySummary),
    tags: normalizeTags([raw.department ?? '', raw.team ?? '']),
    description: raw.descriptionHtml ?? '',
    published_at: toIsoUtc(raw.publishedAt),
  };
}

export function normalizeAshbyResponse(payload: unknown, board: Board) {
  const { jobs: rawJobs } = z.object({ jobs: z.array(z.unknown()) }).parse(payload);
  const jobs: Job[] = [];
  let unlisted = 0;
  for (const rawJob of rawJobs) {
    const parsed = ashbyJobSchema.safeParse(rawJob);
    if (!parsed.success) continue;
    if (parsed.data.isListed === false) {
      unlisted++;
      continue;
    }
    try {
      jobs.push(normalizeAshbyJob(parsed.data, board));
    } catch {
      // Unparseable date — skip the listing.
    }
  }
  return { jobs, skipped: rawJobs.length - jobs.length - unlisted, unlisted };
}
