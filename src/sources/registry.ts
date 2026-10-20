import { CachedJobSource } from './cache.js';
import type { HttpClient } from './http.js';
import type { JobSource } from './job-source.js';
import { RemotiveSource } from './remotive/client.js';

const HOUR_MS = 60 * 60 * 1000;

/** Builds every enabled source, each wrapped in a cache tuned to that source's rate limits. */
export function createSources(http: HttpClient): JobSource[] {
  return [
    // Remotive advises max 4 requests/day.
    new CachedJobSource(new RemotiveSource(http), {
      ttlMs: 6 * HOUR_MS,
      retryAfterMs: HOUR_MS / 4,
    }),
  ];
}
