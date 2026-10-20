import type { Job } from '../../domain/job.js';
import { logger } from '../../logger.js';
import type { HttpClient } from '../http.js';
import type { JobSource, SourceInfo } from '../job-source.js';
import { normalizeRemoteOkResponse } from './normalize.js';

/**
 * Public Remote OK feed: the latest ~100 remote jobs. The first array element is a
 * legal notice, not a job.
 *
 * Terms (from that notice, 2026-10): link back to the job's Remote OK URL (followed, no
 * `nofollow`) and mention Remote OK as the source, or API access gets suspended; don't
 * use their logo. No rate limit is stated; we cache for 2 hours.
 */
export const REMOTEOK_API_URL = 'https://remoteok.com/api';

export class RemoteOkSource implements JobSource {
  readonly info: SourceInfo = {
    id: 'remoteok',
    name: 'Remote OK',
    homepage: 'https://remoteok.com',
  };

  constructor(private readonly http: HttpClient) {}

  async fetchJobs(): Promise<Job[]> {
    const { jobs, skipped } = normalizeRemoteOkResponse(await this.http.getJson(REMOTEOK_API_URL));
    if (skipped > 0) logger.warn('skipped invalid listings', { source: 'remoteok', skipped });
    return jobs;
  }
}
