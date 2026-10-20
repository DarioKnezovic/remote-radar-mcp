import type { Job, SourceId } from '../domain/job.js';
import type { CachedFetch, FailedFetch, FetchCacheStore } from '../sources/cache.js';
import type { JobRepository } from './job-repository.js';

/**
 * Persists source fetches in Postgres: the jobs of the latest successful fetch are
 * the rows whose `last_seen_at` is at or after that fetch's timestamp.
 */
export class PostgresFetchCacheStore implements FetchCacheStore {
  constructor(private readonly repository: JobRepository) {}

  async latestSuccess(source: SourceId): Promise<CachedFetch | undefined> {
    const fetch = await this.repository.latestFetch(source, true);
    if (!fetch) return undefined;
    const jobs = await this.repository.listJobsSeenSince(source, fetch.at);
    return { jobs, fetchedAt: fetch.at.getTime() };
  }

  async latestFailure(source: SourceId): Promise<FailedFetch | undefined> {
    const fetch = await this.repository.latestFetch(source, false);
    return fetch && { error: fetch.error ?? 'unknown error', at: fetch.at.getTime() };
  }

  saveSuccess(source: SourceId, jobs: readonly Job[], at: number): Promise<void> {
    return this.repository.recordSuccessfulFetch(source, jobs, new Date(at));
  }

  saveFailure(source: SourceId, error: string, at: number): Promise<void> {
    return this.repository.recordFailedFetch(source, error, new Date(at));
  }
}
