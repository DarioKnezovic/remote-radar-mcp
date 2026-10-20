import type { Job, SourceId } from '../domain/job.js';
import { logger } from '../logger.js';
import type { JobSource, SourceInfo } from './job-source.js';

export interface CachedFetch {
  jobs: Job[];
  fetchedAt: number;
}

export interface FailedFetch {
  error: string;
  at: number;
}

/**
 * Where fetch results and failures are remembered. Postgres in production, so the
 * cache (and therefore the rate limit) survives server restarts; in-memory in tests.
 */
export interface FetchCacheStore {
  /** Jobs from the most recent successful fetch. */
  latestSuccess(source: SourceId): Promise<CachedFetch | undefined>;
  /** Most recent failed fetch, if any. */
  latestFailure(source: SourceId): Promise<FailedFetch | undefined>;
  saveSuccess(source: SourceId, jobs: readonly Job[], at: number): Promise<void>;
  saveFailure(source: SourceId, error: string, at: number): Promise<void>;
}

export class MemoryFetchCacheStore implements FetchCacheStore {
  private readonly successes = new Map<SourceId, CachedFetch>();
  private readonly failures = new Map<SourceId, FailedFetch>();

  latestSuccess(source: SourceId) {
    return Promise.resolve(this.successes.get(source));
  }

  latestFailure(source: SourceId) {
    return Promise.resolve(this.failures.get(source));
  }

  saveSuccess(source: SourceId, jobs: readonly Job[], at: number) {
    this.successes.set(source, { jobs: [...jobs], fetchedAt: at });
    return Promise.resolve();
  }

  saveFailure(source: SourceId, error: string, at: number) {
    this.failures.set(source, { error, at });
    return Promise.resolve();
  }
}

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
 * - Concurrent callers in this process share one in-flight request.
 * - If a refresh fails, the last good result is served (stale) when available.
 * - Failures are also throttled, so an outage doesn't turn into a retry storm.
 */
export class CachedJobSource implements JobSource {
  readonly info: SourceInfo;
  private inFlight: Promise<Job[]> | undefined;
  private readonly now: () => number;

  constructor(
    private readonly inner: JobSource,
    private readonly store: FetchCacheStore,
    private readonly options: CacheOptions,
  ) {
    this.info = inner.info;
    this.now = options.now ?? Date.now;
  }

  fetchJobs(): Promise<Job[]> {
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async load(): Promise<Job[]> {
    const source = this.info.id;
    const now = this.now();
    const cached = await this.store.latestSuccess(source);
    if (cached && now - cached.fetchedAt < this.options.ttlMs) return cached.jobs;

    const failure = await this.store.latestFailure(source);
    const recentFailure =
      failure !== undefined &&
      now - failure.at < this.options.retryAfterMs &&
      (!cached || failure.at > cached.fetchedAt);
    if (recentFailure) {
      if (cached) return cached.jobs;
      throw new Error(`${this.info.name} is unavailable (${failure.error}); retrying later`);
    }

    let jobs: Job[];
    try {
      jobs = await this.inner.fetchJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.saveFailure(source, message, now);
      if (!cached) throw error;
      logger.warn('refresh failed, serving cached jobs', { source, error: message });
      return cached.jobs;
    }

    await this.store.saveSuccess(source, jobs, now);
    logger.info('fetched jobs', { source, count: jobs.length });
    return jobs;
  }
}
