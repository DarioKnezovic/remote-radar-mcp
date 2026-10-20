import { describe, expect, it } from 'vitest';
import { CachedJobSource, MemoryFetchCacheStore } from '../../src/sources/cache.js';
import type { HttpClient } from '../../src/sources/http.js';
import { createSources } from '../../src/sources/registry.js';

describe('createSources', () => {
  const http: HttpClient = { getJson: () => Promise.reject(new Error('no network in tests')) };

  it('enables the v1 sources, each behind the rate-limiting cache', () => {
    const sources = createSources(http, new MemoryFetchCacheStore());
    expect(sources.map((source) => source.info.id)).toEqual(['remotive', 'arbeitnow']);
    for (const source of sources) expect(source).toBeInstanceOf(CachedJobSource);
  });
});
