import { describe, expect, it } from 'vitest';
import { JobSearchService } from '../../src/services/job-search.js';
import type { JobSource } from '../../src/sources/job-source.js';
import { FakeSource, makeJob, makeProfile } from '../helpers.js';

const now = () => new Date('2026-10-20T12:00:00Z');
const arbeitnowInfo = { id: 'arbeitnow', name: 'Arbeitnow', homepage: 'https://a.test' } as const;

describe('JobSearchService', () => {
  it('merges sources, sorts newest first and applies the limit after filtering', async () => {
    const service = new JobSearchService(
      [
        new FakeSource([
          makeJob({ company: 'A', published_at: '2026-10-01T00:00:00.000Z' }),
          makeJob({ company: 'B', published_at: '2026-10-19T00:00:00.000Z' }),
        ]),
        new FakeSource(
          [
            makeJob({
              source: 'arbeitnow',
              company: 'C',
              published_at: '2026-10-10T00:00:00.000Z',
            }),
            makeJob({ source: 'arbeitnow', company: 'D', remote_scope: 'On-site' }),
          ],
          arbeitnowInfo,
        ),
      ],
      now,
    );

    const result = await service.search({ limit: 2 });

    expect(result.jobs.map((job) => job.company)).toEqual(['B', 'C']);
    expect(result.totalMatches).toBe(3); // D is on-site, excluded by default
    expect(result.sources.map((s) => [s.id, s.ok, s.fetched])).toEqual([
      ['remotive', true, 2],
      ['arbeitnow', true, 2],
    ]);
  });

  it('dedupes across sources', async () => {
    const service = new JobSearchService(
      [
        new FakeSource([makeJob({ company: 'Acme', title: 'Frontend Engineer' })]),
        new FakeSource(
          [
            makeJob({
              source: 'arbeitnow',
              company: 'Acme GmbH',
              title: 'Frontend Engineer (m/w/d)',
            }),
          ],
          arbeitnowInfo,
        ),
      ],
      now,
    );

    const result = await service.search({ limit: 10 });

    expect(result.jobs).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('filters before deduping, so a per-country copy that matches is never lost', async () => {
    // The same role posted for two countries; the US copy is "richer" (has a salary), so
    // deduping first would keep it and a Europe search would then return nothing.
    const us = makeJob({
      company: 'GitLab',
      title: 'Backend Engineer',
      remote_scope: 'US only',
      location: 'Remote, United States',
      salary: 'USD 150,000',
    });
    const germany = makeJob({
      company: 'GitLab',
      title: 'Backend Engineer',
      remote_scope: 'Europe',
      location: 'Remote, Germany',
    });
    const service = new JobSearchService([new FakeSource([us, germany])], now);

    const result = await service.search({ remoteScopes: ['Europe'], limit: 10 });

    expect(result.jobs).toEqual([germany]);
  });

  it('passes every filter through', async () => {
    const service = new JobSearchService(
      [
        new FakeSource([
          makeJob({ title: 'Vue Dev', tags: ['vue'], published_at: '2026-10-18T00:00:00.000Z' }),
          makeJob({
            title: 'Vue Dev Old',
            tags: ['vue'],
            published_at: '2026-09-01T00:00:00.000Z',
          }),
          makeJob({ title: 'Vue Dev US', tags: ['vue'], remote_scope: 'US only', location: 'USA' }),
          makeJob({ title: 'Vue Dev Cheap', tags: ['vue'], salary: 'USD 20,000 per year' }),
        ]),
      ],
      now,
    );

    const result = await service.search({
      query: 'vue',
      tags: ['VUE'],
      remoteScopes: ['Worldwide'],
      postedWithinDays: 7,
      minSalary: { amount: 50_000, currency: 'USD' },
      limit: 10,
    });

    expect(result.jobs.map((job) => job.title)).toEqual(['Vue Dev']);
    const listed = await service.search({ salaryListed: true, limit: 10 });
    expect(listed.jobs.map((job) => job.title)).toEqual(['Vue Dev Cheap']);
  });

  it('reports a failing source without failing the search, including non-Error rejections', async () => {
    const throwsString: JobSource = {
      info: arbeitnowInfo,
      fetchJobs: () => Promise.reject(new Error('socket hang up')),
    };
    const rejectsWithString: JobSource = {
      info: { ...arbeitnowInfo, name: 'Weird' },
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- testing a misbehaving source
      fetchJobs: () => Promise.reject('plain string'),
    };
    const service = new JobSearchService(
      [new FakeSource([makeJob()]), throwsString, rejectsWithString],
      now,
    );

    const result = await service.search({ limit: 10 });

    expect(result.jobs).toHaveLength(1);
    expect(result.sources.map((s) => s.error)).toEqual([
      undefined,
      'socket hang up',
      'plain string',
    ]);
  });

  it('fetches each source once per search, in parallel', async () => {
    const a = new FakeSource([]);
    const b = new FakeSource([], arbeitnowInfo);
    await new JobSearchService([a, b], now).search({ limit: 1 });
    expect([a.calls, b.calls]).toEqual([1, 1]);
  });

  it('names the other places of a role, also those outside the filter', async () => {
    const role = { company: 'Grafana Labs', title: 'Staff Technical Writer' };
    const germany = makeJob({ ...role, location: 'Germany (Remote)', remote_scope: 'Europe' });
    const us = makeJob({ ...role, location: 'United States (Remote)', remote_scope: 'US only' });
    const other = makeJob({ company: 'Acme', location: 'Spain', remote_scope: 'Europe' });
    const service = new JobSearchService([new FakeSource([germany, us, other])], now);

    const result = await service.search({ remoteScopes: ['Europe'], limit: 10 });

    expect(result.jobs.map((job) => job.id)).toEqual([germany.id, other.id]);
    expect(result.otherListings.get(germany.id)).toEqual([
      { job_id: us.id, location: 'United States (Remote)', remote_scope: 'US only', url: us.url },
    ]);
    expect(result.otherListings.has(other.id)).toBe(false);
  });

  it("shows the copy for the profile's country, and lists the others", async () => {
    const role = { company: 'Hostaway', title: 'Senior Backend Engineer' };
    const canada = makeJob({ ...role, location: 'Remote Canada', remote_scope: 'Americas' });
    const bosnia = makeJob({
      ...role,
      location: 'Remote: Bosnia and Herzegovina',
      remote_scope: 'Europe',
      published_at: '2026-09-01T00:00:00.000Z', // older: without a profile, Canada wins
    });
    const service = new JobSearchService([new FakeSource([canada, bosnia])], now);

    expect((await service.search({ limit: 10 })).jobs).toEqual([canada]);

    const result = await service.search({ profile: makeProfile(), limit: 10 });
    expect(result.jobs).toEqual([bosnia]);
    expect(result.otherListings.get(bosnia.id)?.map((o) => o.location)).toEqual(['Remote Canada']);
  });
});
