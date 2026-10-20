import { describe, expect, it } from 'vitest';
import type { Job } from '../../src/domain/job.js';
import { CachedJobSource, MemoryFetchCacheStore } from '../../src/sources/cache.js';
import type { JobSource } from '../../src/sources/job-source.js';
import { makeJob } from '../helpers.js';

/** Source whose next result can be swapped between calls. */
class ScriptedSource implements JobSource {
  readonly info = { id: 'remotive', name: 'Scripted', homepage: 'https://x.test' } as const;
  calls = 0;
  next: Job[] | Error = [];

  fetchJobs(): Promise<Job[]> {
    this.calls++;
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

function setup({ ttlMs = 1000, retryAfterMs = 100 } = {}) {
  let time = 0;
  const store = new MemoryFetchCacheStore();
  const inner = new ScriptedSource();
  const options = { ttlMs, retryAfterMs, now: () => time };
  const cached = new CachedJobSource(inner, store, options);
  return {
    inner,
    cached,
    store,
    advance: (ms: number) => (time += ms),
    /** A fresh wrapper over the same store — what a server restart looks like. */
    restart: () => new CachedJobSource(inner, store, options),
  };
}

describe('CachedJobSource', () => {
  it('reuses results within the TTL and refetches after it', async () => {
    const { inner, cached, advance } = setup();
    const first = [makeJob()];
    inner.next = first;

    expect(await cached.fetchJobs()).toEqual(first);
    advance(999);
    expect(await cached.fetchJobs()).toEqual(first);
    expect(inner.calls).toBe(1);

    advance(1);
    await cached.fetchJobs();
    expect(inner.calls).toBe(2);
  });

  it('keeps honouring the TTL across restarts (state lives in the store)', async () => {
    const { inner, cached, restart } = setup();
    inner.next = [makeJob()];
    await cached.fetchJobs();

    await restart().fetchJobs();
    expect(inner.calls).toBe(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const { inner, cached } = setup();
    await Promise.all([cached.fetchJobs(), cached.fetchJobs(), cached.fetchJobs()]);
    expect(inner.calls).toBe(1);
  });

  it('serves stale results when a refresh fails', async () => {
    const { inner, cached, advance } = setup();
    const good = [makeJob()];
    inner.next = good;
    await cached.fetchJobs();

    advance(2000);
    inner.next = new Error('503');
    expect(await cached.fetchJobs()).toEqual(good);
  });

  it('rethrows when there is nothing cached', async () => {
    const { inner, cached } = setup();
    inner.next = new Error('boom');
    await expect(cached.fetchJobs()).rejects.toThrow('boom');
  });

  it('does not retry a failing source before retryAfterMs', async () => {
    const { inner, cached, advance } = setup();
    inner.next = new Error('boom');
    await expect(cached.fetchJobs()).rejects.toThrow('boom');
    await expect(cached.fetchJobs()).rejects.toThrow(/unavailable \(boom\)/);
    expect(inner.calls).toBe(1);

    advance(100);
    inner.next = [];
    await expect(cached.fetchJobs()).resolves.toEqual([]);
    expect(inner.calls).toBe(2);
  });

  it('ignores a failure older than the latest success', async () => {
    // retryAfterMs longer than the TTL, so only the "failure is older" rule allows a refetch.
    const { inner, cached, store, advance } = setup({ ttlMs: 10, retryAfterMs: 1000 });
    await store.saveFailure('remotive', 'old outage', 0);
    await store.saveSuccess('remotive', [makeJob()], 1); // recovered right after

    advance(11); // TTL expired; the failure at t=0 is still within retryAfterMs
    await cached.fetchJobs();
    expect(inner.calls).toBe(1);
  });
});
