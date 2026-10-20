import { makeJobId, type EmploymentType, type Job, type RemoteScope } from '../../domain/job.js';
import { detectRegions, scopeFromRegions } from '../../domain/remote-scope.js';
import { normalizeTags, textOrNull, toIsoUtc } from '../normalize-helpers.js';
import { arbeitnowJobSchema, arbeitnowResponseSchema, type ArbeitnowJob } from './schema.js';

/** "Remote" in English, German, Dutch and French, as seen in Arbeitnow locations. */
const REMOTE_HINT =
  /\b(?:remote|home[\s-]?office|werken op afstand|t[ée]l[ée]travail)\b|à distance/i;

/**
 * `job_types` mixes languages and also carries seniority labels ("Mid", "berufserfahren"),
 * which are ignored. When several types match, the first in this list wins: an
 * internship is an internship even if it's also "full time".
 */
const EMPLOYMENT_PATTERNS: readonly (readonly [EmploymentType, RegExp])[] = [
  ['internship', /\b(?:intern(?:ship)?|praktikum\w*|stage|convention de stage)\b/i],
  [
    'freelance',
    /\b(?:freelanc\w*|freiberufl\w*|selbstst[äa]ndig\w*|self-employed|ind[ée]pendant|auto-entrepreneur)\b/i,
  ],
  ['full_time', /\b(?:full[\s-]?time|vollzeit|permanent|unbefristet\w*|cdi|indefinite)\b/i],
  [
    'part_time',
    /\b(?:part[\s-]?time|teilzeit|werkstudent\w*|working student|minijob|nebent[äa]tigkeit)\b/i,
  ],
  ['contract', /\b(?:contract(?:or)?|temporary|fixed[\s-]term|befristet\w*|cdd)\b/i],
];

export function mapEmploymentType(jobTypes: readonly string[]): EmploymentType {
  for (const [type, pattern] of EMPLOYMENT_PATTERNS) {
    if (jobTypes.some((jobType) => pattern.test(jobType))) return type;
  }
  return 'unknown';
}

/** Some listings put the location in the title: "Staff PM, Platform |  Germany | Remote". */
function splitTitle(rawTitle: string): { title: string; extra: string | null } {
  const [title = rawTitle, ...rest] = rawTitle.split('|').map((part) => part.trim());
  const extra = rest.filter(Boolean).join(', ');
  return { title: title || rawTitle, extra: extra || null };
}

/**
 * Scope of a remote listing from its location, falling back to the title
 * ("Backend Developer - Remote from EU"). A city ("Berlin") or just "Remote" says
 * nothing about where remote work is allowed, so it stays `Unknown`.
 */
export function remoteScopeFor(
  isRemote: boolean,
  location: string | null,
  title: string,
): RemoteScope {
  if (!isRemote) return 'On-site';
  const fromLocation = detectRegions(location);
  if (fromLocation.size > 0) return scopeFromRegions(fromLocation);
  // "Global"/"International" in a title describes the role ("Global Head of Sales"), not eligibility.
  const fromTitle = new Set([...detectRegions(title)].filter((region) => region !== 'worldwide'));
  return scopeFromRegions(fromTitle);
}

export function normalizeArbeitnowJob(raw: ArbeitnowJob): Job {
  const { title, extra } = splitTitle(raw.title);
  const location = textOrNull(raw.location) ?? extra;
  const isRemote = raw.remote === true || REMOTE_HINT.test(location ?? '');
  return {
    id: makeJobId('arbeitnow', raw.slug),
    source: 'arbeitnow',
    source_job_id: raw.slug,
    url: raw.url,
    title,
    company: raw.company_name.trim(),
    location,
    remote_scope: remoteScopeFor(isRemote, location, title),
    employment_type: mapEmploymentType(raw.job_types ?? []),
    // Arbeitnow has no salary field.
    salary: null,
    tags: normalizeTags(raw.tags ?? []),
    description: raw.description ?? '',
    published_at: toIsoUtc(raw.created_at),
  };
}

export interface NormalizeResult {
  jobs: Job[];
  /** Listings that failed validation and were skipped. */
  skipped: number;
  /** URL of the next page, if any. */
  next: string | null;
}

/** Validates and normalizes one page of `/api/job-board-api`. Throws if the envelope itself is wrong. */
export function normalizeArbeitnowResponse(payload: unknown): NormalizeResult {
  const { data, links } = arbeitnowResponseSchema.parse(payload);
  const jobs: Job[] = [];
  for (const rawJob of data) {
    const parsed = arbeitnowJobSchema.safeParse(rawJob);
    if (!parsed.success) continue;
    jobs.push(normalizeArbeitnowJob(parsed.data));
  }
  return { jobs, skipped: data.length - jobs.length, next: links?.next ?? null };
}
