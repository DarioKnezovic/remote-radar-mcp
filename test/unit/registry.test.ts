import { describe, expect, it } from 'vitest';
import { loadBoardsConfig, resolveBoardsFile } from '../../src/sources/boards-config.js';
import { CachedJobSource, MemoryFetchCacheStore } from '../../src/sources/cache.js';
import type { HttpClient } from '../../src/sources/http.js';
import { createSources } from '../../src/sources/registry.js';

describe('createSources', () => {
  const http: HttpClient = { getJson: () => Promise.reject(new Error('no network in tests')) };

  it('enables the job-board sources, each behind the rate-limiting cache', () => {
    const sources = createSources(http, new MemoryFetchCacheStore());
    expect(sources.map((source) => source.info.id)).toEqual(['remotive', 'arbeitnow', 'remoteok']);
    for (const source of sources) expect(source).toBeInstanceOf(CachedJobSource);
  });

  it('adds a company-board source per ATS that has boards configured', () => {
    const sources = createSources(http, new MemoryFetchCacheStore(), {
      greenhouse: [{ board: 'gitlab', company: 'GitLab' }],
      lever: [],
      ashby: [{ board: 'linear', company: 'Linear' }],
    });
    expect(sources.map((source) => source.info.id)).toEqual([
      'remotive',
      'arbeitnow',
      'remoteok',
      'greenhouse',
      'ashby',
    ]);
  });

  it('enables all six sources with the committed starter boards', async () => {
    const boards = await loadBoardsConfig(await resolveBoardsFile({}));
    expect(createSources(http, new MemoryFetchCacheStore(), boards)).toHaveLength(6);
  });
});
