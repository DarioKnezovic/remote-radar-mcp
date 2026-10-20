import type { Job } from '../domain/job.js';
import { logger } from '../logger.js';
import type { JobSource, SourceInfo } from './job-source.js';

export interface CacheOptions {
  /** How long a successful fetch is reused before the source is called again. */
  ttlMs: number;
  /** After a failed fetch, wait at least this long before calling the source again. */
  retryAfterMs: number;
  now?: () => number;
}

/**
 * Wraps a {@link JobSource} so it is called at most once per TTL, which is how we
 * honour each source's rate limits (e.g. Remotive: max ~4 requests/day).
 *
 * - Concurrent callers share one in-flight request.
 * - If a refresh fails, the last good result is served (stale) when available.
 * - Failures are also throttled, so an outage doesn't turn into a retry storm.
 */
export class CachedJobSource implements JobSource {
  readonly info: SourceInfo;
  private cached: { jobs: Job[]; fetchedAt: number } | undefined;
  private lastFailure: { error: Error; at: number } | undefined;
  private inFlight: Promise<Job[]> | undefined;
  private readonly now: () => number;

  constructor(
    private readonly inner: JobSource,
    private readonly options: CacheOptions,
  ) {
    this.info = inner.info;
    this.now = options.now ?? Date.now;
  }

  fetchJobs(): Promise<Job[]> {
    const now = this.now();
    if (this.cached && now - this.cached.fetchedAt < this.options.ttlMs) {
      return Promise.resolve(this.cached.jobs);
    }
    if (this.lastFailure && now - this.lastFailure.at < this.options.retryAfterMs) {
      return this.cached
        ? Promise.resolve(this.cached.jobs)
        : Promise.reject(this.lastFailure.error);
    }
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<Job[]> {
    try {
      const jobs = await this.inner.fetchJobs();
      this.cached = { jobs, fetchedAt: this.now() };
      this.lastFailure = undefined;
      logger.info('fetched jobs', { source: this.info.id, count: jobs.length });
      return jobs;
    } catch (error) {
      this.lastFailure = {
        error: error instanceof Error ? error : new Error(String(error)),
        at: this.now(),
      };
      if (!this.cached) throw error;
      logger.warn('refresh failed, serving cached jobs', {
        source: this.info.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.cached.jobs;
    }
  }
}
