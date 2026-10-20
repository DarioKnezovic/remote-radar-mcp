import { describe, expect, it } from 'vitest';
import { dedupeJobs } from '../../src/domain/dedupe.js';
import { normalizeArbeitnowResponse } from '../../src/sources/arbeitnow/normalize.js';
import { normalizeRemotiveResponse } from '../../src/sources/remotive/normalize.js';
import { loadFixture } from '../helpers.js';

/** Dedupe against real recorded listings from both sources, merged as search_jobs does. */
describe('dedupeJobs on recorded fixtures', () => {
  const remotive = normalizeRemotiveResponse(loadFixture('remotive.json')).jobs;
  const arbeitnow = normalizeArbeitnowResponse(loadFixture('arbeitnow.json')).jobs;
  const all = [...remotive, ...arbeitnow];
  const result = dedupeJobs(all);
  const kept = (company: string) =>
    result.jobs.filter((job) => job.company === company).map((job) => job.title);

  it('removes exactly the two real duplicate postings', () => {
    expect(all).toHaveLength(27);
    expect(result.removed).toBe(2);
  });

  it('collapses an identical repost (Eggai, same title and location)', () => {
    expect(kept('Eggai')).toEqual(['Senior Accountant – Finance Operations (m/f/d)']);
  });

  it('collapses the same role posted for two cities (IONOS: Berlin and Karlsruhe)', () => {
    expect(kept('IONOS SE')).toEqual(['Digital Media Manager (w/m/d) Programmatic & Social']);
  });

  it('keeps different roles at the same company', () => {
    expect(kept('Circuithub').sort()).toEqual([
      'Software Engineer, Front End & Design',
      'Software Engineer, Product',
    ]);
    expect(kept('Lemon.io').sort()).toEqual([
      'Senior React Full-stack Developer',
      'Senior back-end Engineer',
    ]);
    expect(kept('Coalition Technologies').sort()).toEqual([
      'Freelance Copywriter',
      'Remote Office Assistant',
    ]);
  });

  it('is stable: deduping the result again removes nothing', () => {
    expect(dedupeJobs(result.jobs).removed).toBe(0);
  });
});
