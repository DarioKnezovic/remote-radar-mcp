import { describe, expect, it } from 'vitest';
import { HttpError, type HttpClient } from '../../src/sources/http.js';
import { createRecruiteeSource } from '../../src/sources/recruitee/client.js';
import { createSmartRecruitersSource } from '../../src/sources/smartrecruiters/client.js';
import { createWorkableSource } from '../../src/sources/workable/client.js';
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

const SR = 'https://api.smartrecruiters.com/v1/companies/Canva/postings';
const SR_LIST = `${SR}?limit=100&locationType=REMOTE`;

function smartRecruitersResponses(): Record<string, unknown> {
  const details = loadFixture('smartrecruiters-canva-details.json') as Record<string, unknown>;
  return {
    [SR_LIST]: loadFixture('smartrecruiters-canva.json'),
    ...Object.fromEntries(Object.entries(details).map(([id, detail]) => [`${SR}/${id}`, detail])),
  };
}

describe('ATS source clients', () => {
  it('Recruitee: one request per company subdomain', async () => {
    const codest = 'https://thecodest.recruitee.com/api/offers/';
    const http = new FakeHttp({ [codest]: loadFixture('recruitee-thecodest.json') });
    const source = createRecruiteeSource(http, [
      { board: 'thecodest', company: 'The Codest' },
      { board: 'moved-away', company: 'Gone' },
    ]);

    expect(await source.fetchJobs()).toHaveLength(5);
    expect(http.requested.sort()).toEqual(['https://moved-away.recruitee.com/api/offers/', codest]);
  });

  it('Workable: asks the widget API for details', async () => {
    const url = 'https://apply.workable.com/api/v1/widget/accounts/blueground?details=true';
    const http = new FakeHttp({ [url]: loadFixture('workable-blueground.json') });
    const source = createWorkableSource(http, [{ board: 'blueground', company: 'Blueground' }]);

    expect(await source.fetchJobs()).toHaveLength(3);
    expect(http.requested).toEqual([url]);
  });

  it('SmartRecruiters: lists remote postings, then fetches each detail', async () => {
    const http = new FakeHttp(smartRecruitersResponses());
    const source = createSmartRecruitersSource(http, [{ board: 'Canva', company: 'Canva' }]);

    expect(await source.fetchJobs()).toHaveLength(4);
    expect(http.requested[0]).toBe(SR_LIST);
    expect(http.requested).toHaveLength(5);
  });

  it('SmartRecruiters: skips a posting whose detail is gone', async () => {
    const closed = `${SR}/6000000001417410`;
    const responses = Object.fromEntries(
      Object.entries(smartRecruitersResponses()).filter(([url]) => url !== closed),
    );
    const source = createSmartRecruitersSource(new FakeHttp(responses), [
      { board: 'Canva', company: 'Canva' },
    ]);

    expect(await source.fetchJobs()).toHaveLength(3);
  });

  it('SmartRecruiters: a board fails when every detail fails', async () => {
    const http = new FakeHttp({ [SR_LIST]: loadFixture('smartrecruiters-canva.json') });
    const source = createSmartRecruitersSource(http, [{ board: 'Canva', company: 'Canva' }]);

    await expect(source.fetchJobs()).rejects.toThrow(
      'SmartRecruiters job boards: every board failed (Canva: GET',
    );
  });
});
