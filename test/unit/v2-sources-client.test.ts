import { describe, expect, it } from 'vitest';
import { createAshbySource } from '../../src/sources/ashby/client.js';
import { createGreenhouseSource } from '../../src/sources/greenhouse/client.js';
import { HttpError, type HttpClient } from '../../src/sources/http.js';
import { createLeverSource } from '../../src/sources/lever/client.js';
import { REMOTEOK_API_URL, RemoteOkSource } from '../../src/sources/remoteok/client.js';
import { loadFixture } from '../helpers.js';

/** Serves canned responses by URL (404 otherwise) and records what was requested. */
class FakeHttp implements HttpClient {
  readonly requested: string[] = [];
  constructor(private readonly responses: Record<string, unknown>) {}
  getJson(url: string): Promise<unknown> {
    this.requested.push(url);
    return url in this.responses
      ? Promise.resolve(this.responses[url])
      : Promise.reject(new HttpError(url, 404, 'Not Found'));
  }
}

describe('v2 source clients', () => {
  it('Remote OK: fetches the public feed', async () => {
    const http = new FakeHttp({ [REMOTEOK_API_URL]: loadFixture('remoteok.json') });
    expect(await new RemoteOkSource(http).fetchJobs()).toHaveLength(8);
    expect(http.requested).toEqual(['https://remoteok.com/api']);
  });

  it('Greenhouse: one request per board, with content, skipping a missing board', async () => {
    const gitlab = 'https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=true';
    const http = new FakeHttp({ [gitlab]: loadFixture('greenhouse-gitlab.json') });
    const source = createGreenhouseSource(http, [
      { board: 'gitlab', company: 'GitLab' },
      { board: 'moved-away', company: 'Gone' },
    ]);

    const jobs = await source.fetchJobs();

    expect(jobs).toHaveLength(6);
    expect(http.requested.sort()).toEqual([
      gitlab,
      'https://boards-api.greenhouse.io/v1/boards/moved-away/jobs?content=true',
    ]);
  });

  it('Lever: uses the EU host for EU boards', async () => {
    const http = new FakeHttp({
      'https://api.lever.co/v0/postings/spotify?mode=json': loadFixture('lever-spotify.json'),
      'https://api.eu.lever.co/v0/postings/acme-eu?mode=json': [],
    });
    const source = createLeverSource(http, [
      { board: 'spotify', company: 'Spotify', region: 'global' },
      { board: 'acme-eu', company: 'Acme EU', region: 'eu' },
    ]);

    expect(await source.fetchJobs()).toHaveLength(6);
    expect(http.requested).toContain('https://api.eu.lever.co/v0/postings/acme-eu?mode=json');
  });

  it('Ashby: requests compensation, and fails when every board fails', async () => {
    const linear = 'https://api.ashbyhq.com/posting-api/job-board/linear?includeCompensation=true';
    const ok = new FakeHttp({ [linear]: loadFixture('ashby-linear.json') });
    expect(
      await createAshbySource(ok, [{ board: 'linear', company: 'Linear' }]).fetchJobs(),
    ).toHaveLength(4);

    const down = createAshbySource(new FakeHttp({}), [{ board: 'linear', company: 'Linear' }]);
    await expect(down.fetchJobs()).rejects.toThrow(
      'Ashby job boards: every board failed (linear: GET',
    );
  });
});
