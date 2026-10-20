import { describe, expect, it } from 'vitest';
import type { Job } from '../../src/domain/job.js';
import { CachedJobSource } from '../../src/sources/cache.js';
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

function setup() {
  let time = 0;
  const inner = new ScriptedSource();
  const cached = new CachedJobSource(inner, { ttlMs: 1000, retryAfterMs: 100, now: () => time });
  return { inner, cached, advance: (ms: number) => (time += ms) };
}

describe('CachedJobSource', () => {
  it('reuses results within the TTL and refetches after it', async () => {
    const { inner, cached, advance } = setup();
    const first = [makeJob()];
    inner.next = first;

    expect(await cached.fetchJobs()).toBe(first);
    advance(999);
    expect(await cached.fetchJobs()).toBe(first);
    expect(inner.calls).toBe(1);

    advance(1);
    await cached.fetchJobs();
    expect(inner.calls).toBe(2);
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
    expect(await cached.fetchJobs()).toBe(good);
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
    await expect(cached.fetchJobs()).rejects.toThrow('boom');
    expect(inner.calls).toBe(1);

    advance(100);
    inner.next = [];
    await expect(cached.fetchJobs()).resolves.toEqual([]);
    expect(inner.calls).toBe(2);
  });
});
