import { describe, expect, it } from 'vitest';
import {
  filterJobs,
  isPostedWithin,
  matchesQuery,
  matchesRemoteScope,
  matchesTags,
} from '../../src/domain/filter.js';
import { makeJob } from '../helpers.js';

const now = new Date('2026-10-20T12:00:00Z');

describe('matchesQuery', () => {
  const job = makeJob({
    title: 'Senior Full-Stack Developer',
    company: 'Lemon.io',
    tags: ['Node.js', 'C++'],
    description: '<p>We use <b>React</b>&nbsp;and TypeScript. Based in Zürich.</p>',
  });

  it('requires every term, case-insensitively', () => {
    expect(matchesQuery(job, 'react TYPESCRIPT')).toBe(true);
    expect(matchesQuery(job, 'react angular')).toBe(false);
  });

  it('matches whole words only', () => {
    expect(matchesQuery(job, 'type')).toBe(false);
    expect(matchesQuery(job, 'java')).toBe(false);
  });

  it('handles terms with punctuation and diacritics', () => {
    expect(matchesQuery(job, 'node.js')).toBe(true);
    expect(matchesQuery(job, 'c++')).toBe(true);
    expect(matchesQuery(job, 'zurich')).toBe(true);
  });

  it('searches HTML-stripped description text', () => {
    expect(matchesQuery(job, 'b')).toBe(false);
  });
});

describe('matchesTags', () => {
  it('matches any of the given tags, case-insensitively', () => {
    const job = makeJob({ tags: ['React', 'Node.js'] });
    expect(matchesTags(job, ['vue', 'node.js'])).toBe(true);
    expect(matchesTags(job, ['vue'])).toBe(false);
  });
});

describe('matchesRemoteScope', () => {
  it('excludes on-site jobs by default', () => {
    expect(matchesRemoteScope(makeJob({ remote_scope: 'On-site' }), undefined)).toBe(false);
    expect(matchesRemoteScope(makeJob({ remote_scope: 'US only' }), undefined)).toBe(true);
  });

  it('includes on-site jobs when asked for explicitly', () => {
    expect(matchesRemoteScope(makeJob({ remote_scope: 'On-site' }), ['On-site'])).toBe(true);
  });

  it('matches any of several scopes', () => {
    const job = makeJob({ remote_scope: 'EU only' });
    expect(matchesRemoteScope(job, ['Worldwide', 'EU only'])).toBe(true);
    expect(matchesRemoteScope(job, ['Worldwide'])).toBe(false);
  });

  it('matches multi-region jobs whose location includes the wanted region', () => {
    const job = makeJob({ remote_scope: 'Multi-region', location: 'Europe, USA, Canada, APAC' });
    expect(matchesRemoteScope(job, ['Europe'])).toBe(true);
    expect(matchesRemoteScope(job, ['US only'])).toBe(true);
    expect(matchesRemoteScope(job, ['EU only'])).toBe(false);
    expect(matchesRemoteScope(job, ['Worldwide'])).toBe(false);
  });
});

describe('isPostedWithin', () => {
  it('compares against the given clock', () => {
    const job = makeJob({ published_at: '2026-10-14T12:00:00.000Z' });
    expect(isPostedWithin(job, 7, now)).toBe(true);
    expect(isPostedWithin(job, 5, now)).toBe(false);
  });
});

describe('filterJobs', () => {
  it('combines all criteria', () => {
    const match = makeJob({ title: 'React Lead', remote_scope: 'Europe', location: 'Europe' });
    const jobs = [
      match,
      makeJob({ title: 'React Lead', remote_scope: 'US only', location: 'USA' }),
      makeJob({
        title: 'Angular Dev',
        remote_scope: 'Europe',
        location: 'Europe',
        description: '<p>Angular only.</p>',
        tags: ['angular', 'typescript'],
      }),
      makeJob({ title: 'React Lead', published_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(
      filterJobs(jobs, {
        query: 'react',
        tags: ['typescript'],
        remoteScopes: ['Europe', 'Worldwide'],
        postedWithinDays: 30,
        now,
      }),
    ).toEqual([match]);
  });
});
