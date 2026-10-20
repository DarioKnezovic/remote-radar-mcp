import { describe, expect, it } from 'vitest';
import {
  dedupeJobs,
  normalizeCompany,
  titleSimilarity,
  titleTokens,
} from '../../src/domain/dedupe.js';
import { makeJob } from '../helpers.js';

describe('normalizeCompany', () => {
  it.each([
    ['Acme GmbH', 'acme'],
    ['Acme, Inc.', 'acme'],
    ['ACME Ltd', 'acme'],
    ['Credit Wellness, LLC', 'creditwellness'],
    ['Lemon.io', 'lemonio'],
    ['Zürich Insurance AG', 'zurichinsurance'],
    // A name that is only a suffix-like word is kept.
    ['Company', 'company'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompany(input)).toBe(expected);
  });
});

describe('titleTokens', () => {
  it('drops gender markers and remote noise, unifies spellings', () => {
    expect(titleTokens('Senior Front-End Developer (m/w/d) - Remote')).toEqual(
      new Set(['senior', 'frontend', 'developer']),
    );
    expect(titleTokens('Sr. Full Stack Engineer (all genders)')).toEqual(
      new Set(['senior', 'fullstack', 'engineer']),
    );
  });
});

describe('titleSimilarity', () => {
  it('is 1 for the same role written differently', () => {
    expect(titleSimilarity('Senior Frontend Engineer', 'Senior Front-end Engineer (Remote)')).toBe(
      1,
    );
  });

  it('keeps seniority as a meaningful difference', () => {
    expect(titleSimilarity('Senior Frontend Engineer', 'Frontend Engineer')).toBeLessThan(0.8);
  });
});

describe('dedupeJobs', () => {
  it('removes the same role at the same company and keeps the richer listing', () => {
    const sparse = makeJob({ company: 'Acme GmbH', title: 'Frontend Developer (m/w/d)' });
    const rich = makeJob({
      source: 'arbeitnow',
      company: 'Acme',
      title: 'Frontend Developer',
      salary: '€70k–€90k',
    });
    const other = makeJob({ company: 'Acme', title: 'Backend Developer' });

    const result = dedupeJobs([sparse, other, rich]);

    expect(result.jobs).toEqual([rich, other]);
    expect(result.removed).toBe(1);
  });

  it('keeps similar titles at different companies', () => {
    const jobs = [makeJob({ company: 'Acme' }), makeJob({ company: 'Globex' })];
    expect(dedupeJobs(jobs).jobs).toHaveLength(2);
  });

  it('prefers the newer listing when both are equally rich', () => {
    const older = makeJob({ published_at: '2026-10-01T00:00:00.000Z' });
    const newer = makeJob({ published_at: '2026-10-10T00:00:00.000Z' });
    expect(dedupeJobs([older, newer]).jobs).toEqual([newer]);
  });

  it('returns an empty result for no jobs', () => {
    expect(dedupeJobs([])).toEqual({ jobs: [], removed: 0 });
  });
});
