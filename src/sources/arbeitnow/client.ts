import type { Job } from '../../domain/job.js';
import { logger } from '../../logger.js';
import type { HttpClient } from '../http.js';
import type { JobSource, SourceInfo } from '../job-source.js';
import { normalizeArbeitnowResponse } from './normalize.js';

/**
 * Public Arbeitnow endpoint: 300 jobs per page, newest first, updated hourly. There
 * are no search or remote filters (only `visa_sponsorship`), so we read the first
 * few pages and filter locally.
 *
 * Terms: free public API, "please do not abuse"; personal, non-commercial use;
 * link back to Arbeitnow.com.
 */
export const ARBEITNOW_API_URL = 'https://www.arbeitnow.com/api/job-board-api';

/** 3 pages ≈ 900 newest jobs, roughly the last few days. */
export const DEFAULT_MAX_PAGES = 3;

/** Only follow pagination links back to the same API endpoint. */
function safeNextUrl(next: string | null): string | null {
  if (!next) return null;
  try {
    const url = new URL(next);
    const base = new URL(ARBEITNOW_API_URL);
    return url.origin === base.origin && url.pathname === base.pathname ? url.toString() : null;
  } catch {
    return null;
  }
}

export class ArbeitnowSource implements JobSource {
  readonly info: SourceInfo = {
    id: 'arbeitnow',
    name: 'Arbeitnow',
    homepage: 'https://www.arbeitnow.com',
  };

  constructor(
    private readonly http: HttpClient,
    private readonly maxPages = DEFAULT_MAX_PAGES,
  ) {}

  async fetchJobs(): Promise<Job[]> {
    const jobs: Job[] = [];
    let skipped = 0;
    let url: string | null = ARBEITNOW_API_URL;

    // Pages are fetched one after another, never in parallel, to stay gentle on the API.
    for (let page = 1; url !== null && page <= this.maxPages; page++) {
      let payload: unknown;
      try {
        payload = await this.http.getJson(url);
      } catch (error) {
        // Without page 1 there's nothing to show; later pages are a bonus.
        if (page === 1) throw error;
        logger.warn('stopping pagination after failed page', {
          source: 'arbeitnow',
          page,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
      const result = normalizeArbeitnowResponse(payload);
      jobs.push(...result.jobs);
      skipped += result.skipped;
      url = safeNextUrl(result.next);
    }

    if (skipped > 0) logger.warn('skipped invalid listings', { source: 'arbeitnow', skipped });
    return jobs;
  }
}
