import { describe, expect, it } from 'vitest';
import { jobSchema } from '../../src/domain/job.js';
import { normalizeRemotiveResponse } from '../../src/sources/remotive/normalize.js';
import { loadFixture } from '../helpers.js';

// Recorded from https://remotive.com/api/remote-jobs on 2026-10-20.
const fixture = loadFixture('remotive.json');

describe('normalizeRemotiveResponse (recorded fixture)', () => {
  const { jobs, skipped } = normalizeRemotiveResponse(fixture);
  const byId = (id: string) => jobs.find((job) => job.id === `remotive:${id}`);

  it('normalizes every listing into a valid Job', () => {
    expect(jobs).toHaveLength(10);
    expect(skipped).toBe(0);
    for (const job of jobs) expect(() => jobSchema.parse(job)).not.toThrow();
  });

  it('maps the core fields of a listing', () => {
    expect(byId('2091158')).toMatchObject({
      id: 'remotive:2091158',
      source: 'remotive',
      source_job_id: '2091158',
      url: expect.stringContaining('https://remotive.com/remote-jobs/') as string,
      title: 'Software Engineer, AI Coding Tasks',
      company: 'Askable',
      location: 'Worldwide',
      remote_scope: 'Worldwide',
      employment_type: 'contract',
      salary: '$1000 per task',
      published_at: '2026-10-17T16:04:29.000Z',
    });
  });

  it('treats timezone-less publication dates as UTC', () => {
    expect(byId('2091144')?.published_at).toBe('2026-09-21T12:55:11.000Z');
  });

  it('trims company names', () => {
    expect(byId('1680495')?.company).toBe('Coalition Technologies');
  });

  it('turns an empty salary into null', () => {
    expect(byId('2091045')?.salary).toBeNull();
  });

  it('classifies remote scope from candidate_required_location', () => {
    expect(byId('2069746')?.remote_scope).toBe('Americas'); // "USA, Canada, USA timezones"
    expect(byId('2091144')?.remote_scope).toBe('US only'); // "USA"
    expect(byId('2091133')?.remote_scope).toBe('Multi-region'); // "Europe, USA, Canada, APAC"
  });

  it('maps job_type to employment_type', () => {
    expect(byId('2091144')?.employment_type).toBe('part_time');
    expect(byId('1185979')?.employment_type).toBe('freelance');
    expect(byId('2069746')?.employment_type).toBe('full_time');
  });

  it('keeps tags', () => {
    expect(byId('2091158')?.tags).toEqual(expect.arrayContaining(['docker', 'rust']));
  });
});

describe('normalizeRemotiveResponse (edge cases)', () => {
  const valid = {
    id: 1,
    url: 'https://remotive.com/remote-jobs/x',
    title: 'Dev',
    company_name: 'Co',
    publication_date: '2026-10-01T00:00:00',
  };

  it('skips invalid listings instead of failing the whole feed', () => {
    const result = normalizeRemotiveResponse({
      jobs: [
        valid,
        { id: 2, title: 'No url' },
        { ...valid, id: 3, publication_date: 'not a date' },
      ],
    });
    expect(result.jobs.map((job) => job.id)).toEqual(['remotive:1']);
    expect(result.skipped).toBe(2);
  });

  it('fills defaults for missing optional fields', () => {
    const [job] = normalizeRemotiveResponse({ jobs: [valid] }).jobs;
    expect(job).toMatchObject({
      location: null,
      remote_scope: 'Unknown',
      employment_type: 'unknown',
      salary: null,
      tags: [],
      description: '',
    });
  });

  it('dedupes tags case-insensitively', () => {
    const [job] = normalizeRemotiveResponse({
      jobs: [{ ...valid, tags: ['React', 'react', ' TypeScript ', ''] }],
    }).jobs;
    expect(job?.tags).toEqual(['React', 'TypeScript']);
  });

  it('throws when the response envelope is wrong', () => {
    expect(() => normalizeRemotiveResponse({ error: 'blocked' })).toThrow();
  });
});
