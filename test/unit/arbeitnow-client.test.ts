import { describe, expect, it } from 'vitest';
import { ARBEITNOW_API_URL, ArbeitnowSource } from '../../src/sources/arbeitnow/client.js';
import { HttpError, type HttpClient } from '../../src/sources/http.js';
import { loadFixture } from '../helpers.js';

const page1 = loadFixture('arbeitnow.json');

function listing(slug: string) {
  return {
    slug,
    company_name: 'Co',
    title: `Job ${slug}`,
    url: `https://www.arbeitnow.com/jobs/companies/co/${slug}`,
    remote: true,
    location: 'Germany',
    created_at: 1792500000,
  };
}

function page(slugs: string[], next: string | null) {
  return { data: slugs.map(listing), links: { next } };
}

/** HttpClient that serves canned responses by URL and records what was requested. */
class FakeHttp implements HttpClient {
  readonly requested: string[] = [];

  constructor(private readonly responses: Record<string, unknown>) {}

  getJson(url: string): Promise<unknown> {
    this.requested.push(url);
    const response = this.responses[url];
    if (response === undefined) return Promise.reject(new HttpError(url, 404, 'Not Found'));
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(response);
  }
}

const PAGE = (n: number) => `${ARBEITNOW_API_URL}?page=${n}`;

describe('ArbeitnowSource', () => {
  it('follows pagination up to maxPages, sequentially', async () => {
    const http = new FakeHttp({
      [ARBEITNOW_API_URL]: page1, // recorded page, links.next = ?page=2
      [PAGE(2)]: page(['p2'], PAGE(3)),
      [PAGE(3)]: page(['p3'], PAGE(4)),
      [PAGE(4)]: page(['p4'], null),
    });

    const jobs = await new ArbeitnowSource(http, 3).fetchJobs();

    expect(http.requested).toEqual([ARBEITNOW_API_URL, PAGE(2), PAGE(3)]);
    expect(jobs).toHaveLength(17 + 1 + 1);
  });

  it('stops when there is no next page', async () => {
    const http = new FakeHttp({ [ARBEITNOW_API_URL]: page(['only'], null) });
    const jobs = await new ArbeitnowSource(http).fetchJobs();
    expect(jobs.map((job) => job.id)).toEqual(['arbeitnow:only']);
    expect(http.requested).toHaveLength(1);
  });

  it('never follows a next link to another host or path', async () => {
    const http = new FakeHttp({
      [ARBEITNOW_API_URL]: page(['a'], 'https://evil.example/api/job-board-api?page=2'),
    });
    await new ArbeitnowSource(http).fetchJobs();
    expect(http.requested).toEqual([ARBEITNOW_API_URL]);
  });

  it('keeps earlier pages when a later page fails', async () => {
    const http = new FakeHttp({
      [ARBEITNOW_API_URL]: page(['a'], PAGE(2)),
      [PAGE(2)]: new HttpError(PAGE(2), 429, 'Too Many Requests'),
    });
    const jobs = await new ArbeitnowSource(http).fetchJobs();
    expect(jobs.map((job) => job.id)).toEqual(['arbeitnow:a']);
  });

  it('fails when the first page fails', async () => {
    const http = new FakeHttp({});
    await expect(new ArbeitnowSource(http).fetchJobs()).rejects.toBeInstanceOf(HttpError);
  });
});
