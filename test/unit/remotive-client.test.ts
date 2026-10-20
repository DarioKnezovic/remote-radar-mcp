import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, HttpError, type FetchFn } from '../../src/sources/http.js';
import { REMOTIVE_API_URL, RemotiveSource } from '../../src/sources/remotive/client.js';
import { loadFixture } from '../helpers.js';

function fakeFetch(response: Response): FetchFn & ReturnType<typeof vi.fn> {
  return vi.fn<FetchFn>(() => Promise.resolve(response));
}

describe('RemotiveSource', () => {
  it('fetches the public feed with a User-Agent and normalizes it', async () => {
    const fetchFn = fakeFetch(Response.json(loadFixture('remotive.json')));
    const source = new RemotiveSource(createHttpClient({ userAgent: 'test-agent', fetchFn }));

    const jobs = await source.fetchJobs();

    expect(jobs).toHaveLength(10);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as Parameters<FetchFn>;
    expect(url).toBe(REMOTIVE_API_URL);
    expect(init?.headers).toMatchObject({ 'User-Agent': 'test-agent' });
  });

  it('raises HttpError on non-2xx responses', async () => {
    const fetchFn = fakeFetch(new Response('Too Many Requests', { status: 429 }));
    const source = new RemotiveSource(createHttpClient({ userAgent: 'test', fetchFn }));

    await expect(source.fetchJobs()).rejects.toBeInstanceOf(HttpError);
  });
});
