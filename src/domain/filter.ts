import type { Job, RemoteScope } from './job.js';
import { detectRegions, type Region } from './remote-scope.js';
import { paysAtLeast, type MinSalary } from './salary.js';
import { foldText, htmlToText } from './text.js';

export interface JobFilter {
  /** Every whitespace-separated term must appear as a whole word in title, company, tags, location or description. */
  query?: string | undefined;
  /** Job must carry at least one of these tags (case-insensitive). */
  tags?: readonly string[] | undefined;
  /** Job must be open to at least one of these scopes. Defaults to every remote scope (on-site excluded). */
  remoteScopes?: readonly RemoteScope[] | undefined;
  postedWithinDays?: number | undefined;
  /** Hides jobs whose stated salary can't reach this a year. Jobs without one are kept. */
  minSalary?: MinSalary | undefined;
  /** Only jobs that state a salary. */
  salaryListed?: boolean | undefined;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Regions a `Multi-region` job must mention to count as open to each scope. */
const SCOPE_REGIONS: Partial<Record<RemoteScope, readonly Region[]>> = {
  Europe: ['europe', 'eu'],
  'EU only': ['eu'],
  'US only': ['us'],
  Americas: ['us', 'americas'],
  Other: ['other'],
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match that also works for terms like "c++", "node.js" or ".net". */
function containsWord(haystack: string, term: string): boolean {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'u').test(
    haystack,
  );
}

function searchableText(job: Job): string {
  return foldText(
    [
      job.title,
      job.company,
      job.tags.join(' '),
      job.location ?? '',
      htmlToText(job.description),
    ].join('\n'),
  );
}

export function matchesQuery(job: Job, query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = searchableText(job);
  return terms.every((term) => containsWord(haystack, term));
}

export function matchesTags(job: Job, tags: readonly string[]): boolean {
  if (tags.length === 0) return true;
  const jobTags = new Set(job.tags.map(foldText));
  return tags.some((tag) => jobTags.has(foldText(tag.trim())));
}

export function matchesRemoteScope(job: Job, scopes: readonly RemoteScope[] | undefined): boolean {
  if (!scopes || scopes.length === 0) return job.remote_scope !== 'On-site';
  if (scopes.includes(job.remote_scope)) return true;
  if (job.remote_scope !== 'Multi-region') return false;
  const regions = detectRegions(job.location);
  return scopes.some((scope) => SCOPE_REGIONS[scope]?.some((region) => regions.has(region)));
}

export function isPostedWithin(job: Job, days: number, now: Date): boolean {
  return Date.parse(job.published_at) >= now.getTime() - days * DAY_MS;
}

export function matchesFilter(job: Job, filter: JobFilter): boolean {
  return (
    matchesRemoteScope(job, filter.remoteScopes) &&
    (filter.postedWithinDays === undefined ||
      isPostedWithin(job, filter.postedWithinDays, filter.now)) &&
    (filter.tags === undefined || matchesTags(job, filter.tags)) &&
    (!filter.salaryListed || job.salary !== null) &&
    (filter.minSalary === undefined || paysAtLeast(job, filter.minSalary)) &&
    // Query last: it's the most expensive check.
    (filter.query === undefined || matchesQuery(job, filter.query))
  );
}

export function filterJobs(jobs: readonly Job[], filter: JobFilter): Job[] {
  return jobs.filter((job) => matchesFilter(job, filter));
}
