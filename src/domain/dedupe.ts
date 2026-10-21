import type { Job, RemoteScope } from './job.js';
import { foldText } from './text.js';

/** Minimum word overlap (Jaccard index) for two titles at the same company to count as the same job. */
export const TITLE_SIMILARITY_THRESHOLD = 0.8;

const COMPANY_SUFFIXES = new Set([
  'inc',
  'llc',
  'ltd',
  'limited',
  'gmbh',
  'ag',
  'se',
  'sa',
  'sas',
  'srl',
  'bv',
  'nv',
  'oy',
  'ab',
  'as',
  'plc',
  'corp',
  'corporation',
  'co',
  'company',
  'doo',
  'kg',
  'ug',
]);

/** Words that don't change which role a listing is for. */
const TITLE_NOISE = new Set([
  'remote',
  'fully',
  'hybrid',
  'anywhere',
  'worldwide',
  'm',
  'w',
  'f',
  'd',
  'x',
  'div',
  'all',
  'genders',
  'gn',
]);

export function normalizeCompany(company: string): string {
  const words = foldText(company)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words.at(-1) ?? '')) words.pop();
  return words.join('');
}

/** Titles repeat a lot (one role, many countries); tokenizing each once keeps grouping fast. */
const tokenCache = new Map<string, ReadonlySet<string>>();
const TOKEN_CACHE_LIMIT = 20_000;

export function titleTokens(title: string): ReadonlySet<string> {
  let tokens = tokenCache.get(title);
  if (!tokens) {
    if (tokenCache.size >= TOKEN_CACHE_LIMIT) tokenCache.clear();
    tokens = tokenizeTitle(title);
    tokenCache.set(title, tokens);
  }
  return tokens;
}

function tokenizeTitle(title: string): Set<string> {
  const text = foldText(title)
    // Gender markers common in EU listings: (m/w/d), (f/m/x), (all genders) …
    .replace(/\((?:[mwfdx]\s*\/\s*)+[mwfdx]\)|\(all genders\)/g, ' ')
    .replace(/\bfront[\s-]+end\b/g, 'frontend')
    .replace(/\bback[\s-]+end\b/g, 'backend')
    .replace(/\bfull[\s-]+stack\b/g, 'fullstack')
    .replace(/\bsr\b\.?/g, 'senior')
    .replace(/\bjr\b\.?/g, 'junior');
  return new Set(
    text.split(/[^a-z0-9+#]+/).filter((word) => word.length > 0 && !TITLE_NOISE.has(word)),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

export function isDuplicate(a: Job, b: Job): boolean {
  return (
    normalizeCompany(a.company) === normalizeCompany(b.company) &&
    titleSimilarity(a.title, b.title) >= TITLE_SIMILARITY_THRESHOLD
  );
}

/** Company job boards are the original listing (where you apply); aggregators repost them. */
const COMPANY_BOARD_SOURCES: ReadonlySet<Job['source']> = new Set([
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'smartrecruiters',
  'recruitee',
]);

/** How much useful information a listing carries; the richer copy of a duplicate wins. */
function richness(job: Job): number {
  return (
    (job.salary ? 3 : 0) +
    (COMPANY_BOARD_SOURCES.has(job.source) ? 1.5 : 0) +
    (job.remote_scope !== 'Unknown' ? 2 : 0) +
    (job.employment_type !== 'unknown' ? 1 : 0) +
    Math.min(job.tags.length, 10) / 10 +
    Math.min(job.description.length, 5000) / 5000
  );
}

/** Ranks copies of one role for the user, e.g. by how well their place suits them. Higher wins. */
export type CopyPreference = (job: Job) => number;

function preferred(a: Job, b: Job, prefer: CopyPreference | undefined): Job {
  const fit = prefer ? prefer(a) - prefer(b) : 0;
  if (fit !== 0) return fit > 0 ? a : b;
  const diff = richness(a) - richness(b);
  if (diff !== 0) return diff > 0 ? a : b;
  return a.published_at >= b.published_at ? a : b;
}

export interface DedupeResult {
  jobs: Job[];
  /** How many listings were dropped as duplicates. */
  removed: number;
}

/**
 * Removes listings for the same role at the same company (often the same job posted
 * on two boards, or once per country). Keeps the copy `prefer` ranks highest (when given),
 * then the one with the most information. Order of the surviving jobs follows their first
 * appearance.
 */
export function dedupeJobs(jobs: readonly Job[], prefer?: CopyPreference): DedupeResult {
  const byCompany = new Map<string, Job[]>();
  const order: Job[] = [];

  for (const job of jobs) {
    const key = normalizeCompany(job.company);
    const group = byCompany.get(key) ?? [];
    const kept = group.find((candidate) => isDuplicate(candidate, job));
    if (!kept) {
      group.push(job);
      order.push(job);
    } else {
      const winner = preferred(kept, job, prefer);
      if (winner !== kept) {
        group[group.indexOf(kept)] = winner;
        order[order.indexOf(kept)] = winner;
      }
    }
    byCompany.set(key, group);
  }

  return { jobs: order, removed: jobs.length - order.length };
}

/** Another listing of the same role, posted for a different place. */
export interface OtherListing {
  job_id: string;
  location: string;
  remote_scope: RemoteScope;
  url: string;
}

/**
 * Words of a location without "remote" and punctuation, in any order: "Remote Germany",
 * "Germany (Remote)" and "Remote: Germany" are the same place.
 */
function placeKey(location: string): string {
  const words = foldText(location)
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word !== 'remote');
  return [...new Set(words)].sort().join(' ');
}

/**
 * Where else the same role is posted: listings among `candidates` that dedupe would merge
 * with `job` (many companies post a role once per country), one per place that differs from
 * the job's own location, sorted by location.
 */
export function otherListings(job: Job, candidates: Iterable<Job>): OtherListing[] {
  const seen = new Set([job.location ? placeKey(job.location) : '']);
  const others: OtherListing[] = [];
  for (const other of candidates) {
    if (other.id === job.id || !other.location || !isDuplicate(job, other)) continue;
    const key = placeKey(other.location);
    if (seen.has(key)) continue;
    seen.add(key);
    others.push({
      job_id: other.id,
      location: other.location,
      remote_scope: other.remote_scope,
      url: other.url,
    });
  }
  return others.sort((a, b) => a.location.localeCompare(b.location));
}

/** All jobs by normalized company, to look up candidates for {@link otherListings}. */
export function jobsByCompany(jobs: Iterable<Job>): Map<string, Job[]> {
  const index = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = normalizeCompany(job.company);
    const list = index.get(key);
    if (list) list.push(job);
    else index.set(key, [job]);
  }
  return index;
}
