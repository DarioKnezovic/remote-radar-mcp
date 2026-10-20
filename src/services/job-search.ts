import { dedupeJobs } from '../domain/dedupe.js';
import { filterJobs } from '../domain/filter.js';
import type { Job, RemoteScope } from '../domain/job.js';
import type { JobSource, SourceInfo } from '../sources/job-source.js';

export interface SearchParams {
  query?: string | undefined;
  tags?: readonly string[] | undefined;
  remoteScopes?: readonly RemoteScope[] | undefined;
  postedWithinDays?: number | undefined;
  limit: number;
}

export interface SourceStatus extends SourceInfo {
  ok: boolean;
  /** Listings received from this source, before filtering. */
  fetched: number;
  error?: string;
}

export interface SearchResult {
  /** Newest first, at most `limit`. */
  jobs: Job[];
  /** Matches before `limit` was applied. */
  totalMatches: number;
  duplicatesRemoved: number;
  sources: SourceStatus[];
}

/** Never rejects: a failing source becomes a status entry so the other sources still return results. */
async function fetchFromSource(source: JobSource): Promise<{ jobs: Job[]; status: SourceStatus }> {
  try {
    const jobs = await source.fetchJobs();
    return { jobs, status: { ...source.info, ok: true, fetched: jobs.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { jobs: [], status: { ...source.info, ok: false, fetched: 0, error: message } };
  }
}

/** Fetches from every source in parallel, then filters, dedupes, sorts and limits. */
export class JobSearchService {
  constructor(
    private readonly sources: readonly JobSource[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  async search(params: SearchParams): Promise<SearchResult> {
    const results = await Promise.all(this.sources.map(fetchFromSource));
    const all = results.flatMap((result) => result.jobs);
    const sources = results.map((result) => result.status);

    // Filter first, then dedupe: a role posted once per country ("Remote, US" and "Remote,
    // Germany") must survive a Europe search, whichever copy dedupe would otherwise keep.
    const filtered = filterJobs(all, {
      query: params.query,
      tags: params.tags,
      remoteScopes: params.remoteScopes,
      postedWithinDays: params.postedWithinDays,
      now: this.now(),
    });
    const { jobs: unique, removed } = dedupeJobs(filtered);
    const matches = unique.sort((a, b) => b.published_at.localeCompare(a.published_at));

    return {
      jobs: matches.slice(0, params.limit),
      totalMatches: matches.length,
      duplicatesRemoved: removed,
      sources,
    };
  }
}
