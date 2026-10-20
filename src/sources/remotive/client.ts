import type { Job } from '../../domain/job.js';
import { logger } from '../../logger.js';
import type { HttpClient } from '../http.js';
import type { JobSource, SourceInfo } from '../job-source.js';
import { normalizeRemotiveResponse } from './normalize.js';

/**
 * Public Remotive endpoint. As of 2026-10 the free API ignores the documented
 * `search`/`category`/`limit` parameters and returns the latest ~10 jobs (delayed
 * 24h), so we fetch the plain feed and filter locally.
 *
 * Terms: link back to the Remotive URL and credit Remotive as the source; don't
 * redistribute to other job sites; advised max 4 requests/day.
 */
export const REMOTIVE_API_URL = 'https://remotive.com/api/remote-jobs';

export class RemotiveSource implements JobSource {
  readonly info: SourceInfo = {
    id: 'remotive',
    name: 'Remotive',
    homepage: 'https://remotive.com',
  };

  constructor(private readonly http: HttpClient) {}

  async fetchJobs(): Promise<Job[]> {
    const payload = await this.http.getJson(REMOTIVE_API_URL);
    const { jobs, skipped } = normalizeRemotiveResponse(payload);
    if (skipped > 0) logger.warn('skipped invalid listings', { source: 'remotive', skipped });
    return jobs;
  }
}
