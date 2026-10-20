import { ArbeitnowSource } from './arbeitnow/client.js';
import { CachedJobSource, type FetchCacheStore } from './cache.js';
import type { HttpClient } from './http.js';
import type { JobSource } from './job-source.js';
import { RemotiveSource } from './remotive/client.js';

const HOUR_MS = 60 * 60 * 1000;

/** Builds every enabled source, each wrapped in a cache tuned to that source's rate limits. */
export function createSources(http: HttpClient, store: FetchCacheStore): JobSource[] {
  return [
    // Remotive advises max 4 requests/day.
    new CachedJobSource(new RemotiveSource(http), store, {
      ttlMs: 6 * HOUR_MS,
      retryAfterMs: HOUR_MS / 4,
    }),
    // Arbeitnow updates hourly; one refresh = up to 3 page requests.
    new CachedJobSource(new ArbeitnowSource(http), store, {
      ttlMs: HOUR_MS,
      retryAfterMs: HOUR_MS / 4,
    }),
  ];
}
