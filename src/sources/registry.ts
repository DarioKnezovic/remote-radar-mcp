import { ArbeitnowSource } from './arbeitnow/client.js';
import { createAshbySource } from './ashby/client.js';
import type { BoardsConfig } from './boards-config.js';
import { CachedJobSource, type FetchCacheStore } from './cache.js';
import { createGreenhouseSource } from './greenhouse/client.js';
import type { HttpClient } from './http.js';
import type { JobSource } from './job-source.js';
import { createLeverSource } from './lever/client.js';
import { RemoteOkSource } from './remoteok/client.js';
import { RemotiveSource } from './remotive/client.js';

const HOUR_MS = 60 * 60 * 1000;
const RETRY_AFTER_MS = HOUR_MS / 4;

const EMPTY_BOARDS: BoardsConfig = { greenhouse: [], lever: [], ashby: [] };

/**
 * Builds every enabled source, each wrapped in a cache tuned to that source's rate
 * limits. Company-board sources (Greenhouse, Lever, Ashby) are only enabled when the
 * boards config lists at least one board for them.
 */
export function createSources(
  http: HttpClient,
  store: FetchCacheStore,
  boards: BoardsConfig = EMPTY_BOARDS,
): JobSource[] {
  const cached = (source: JobSource, ttlMs: number) =>
    new CachedJobSource(source, store, { ttlMs, retryAfterMs: RETRY_AFTER_MS });

  return [
    // Remotive advises max 4 requests/day.
    cached(new RemotiveSource(http), 6 * HOUR_MS),
    // Arbeitnow updates hourly; one refresh = up to 3 page requests.
    cached(new ArbeitnowSource(http), HOUR_MS),
    // Remote OK states no limit; its feed is the latest ~100 jobs.
    cached(new RemoteOkSource(http), 2 * HOUR_MS),
    // Company boards change slowly; one refresh = one request per board.
    ...(boards.greenhouse.length > 0
      ? [cached(createGreenhouseSource(http, boards.greenhouse), 6 * HOUR_MS)]
      : []),
    ...(boards.lever.length > 0
      ? [cached(createLeverSource(http, boards.lever), 6 * HOUR_MS)]
      : []),
    ...(boards.ashby.length > 0
      ? [cached(createAshbySource(http, boards.ashby), 6 * HOUR_MS)]
      : []),
  ];
}
