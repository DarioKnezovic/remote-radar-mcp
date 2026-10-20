import type { Job, SourceId } from '../domain/job.js';

export interface SourceInfo {
  id: SourceId;
  /** Human-readable name, shown as attribution next to every job. */
  name: string;
  homepage: string;
}

/**
 * A provider of job listings. Implementations fetch from one official API/feed and
 * normalize into {@link Job}. Caching and rate limiting are layered on top (see
 * `CachedJobSource`), so implementations stay simple: one call = one fetch.
 */
export interface JobSource {
  readonly info: SourceInfo;
  fetchJobs(): Promise<Job[]>;
}
