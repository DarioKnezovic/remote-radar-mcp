import { describe, expect, it } from 'vitest';
import { jobSchema, type Job } from '../../src/domain/job.js';
import { normalizeAshbyResponse } from '../../src/sources/ashby/normalize.js';
import { normalizeGreenhouseResponse } from '../../src/sources/greenhouse/normalize.js';
import { normalizeLeverResponse } from '../../src/sources/lever/normalize.js';
import { normalizeRemoteOkResponse } from '../../src/sources/remoteok/normalize.js';
import { loadFixture } from '../helpers.js';

// All fixtures: trimmed samples recorded 2026-10-20 (see test/fixtures/README.md).

function byTitle(jobs: Job[], prefix: string): Job {
  const job = jobs.find((j) => j.title.startsWith(prefix));
  if (!job) throw new Error(`no fixture job starting with "${prefix}"`);
  return job;
}

function expectValid(jobs: Job[]) {
  for (const job of jobs) expect(() => jobSchema.parse(job)).not.toThrow();
}

describe('Remote OK', () => {
  const { jobs, skipped } = normalizeRemoteOkResponse(loadFixture('remoteok.json'));

  it('skips the legal notice without counting it as an invalid listing', () => {
    expect(jobs).toHaveLength(8);
    expect(skipped).toBe(0);
    expectValid(jobs);
  });

  it('maps fields and links to the Remote OK listing (required by their terms)', () => {
    expect(byTitle(jobs, 'Head of Technology')).toMatchObject({
      id: 'remoteok:1137537',
      source: 'remoteok',
      url: expect.stringMatching(/^https:\/\/remoteOK\.com\/remote-jobs\//) as string,
      salary: 'USD 140,000–250,000 per year',
      published_at: '2026-10-16T17:55:35.000Z',
    });
  });

  it('treats a 0 salary as not given', () => {
    expect(byTitle(jobs, 'Senior Software Engineer').salary).toBeNull();
  });

  it('classifies scope from location, then title; empty location stays Unknown', () => {
    expect(byTitle(jobs, 'Marketing Operations').remote_scope).toBe('US only'); // "Remote - US"
    expect(byTitle(jobs, 'Technical Account Manager').remote_scope).toBe('Americas'); // "Brazil"
    expect(byTitle(jobs, 'Commercial Account Manager LATAM').remote_scope).toBe('Americas'); // title
    expect(byTitle(jobs, 'Key Account Manager').remote_scope).toBe('Unknown'); // "Copenhagen"
    expect(byTitle(jobs, 'Head of Technology').remote_scope).toBe('Unknown'); // ""
  });
});

describe('Greenhouse', () => {
  const gitlab = normalizeGreenhouseResponse(loadFixture('greenhouse-gitlab.json'), {
    board: 'gitlab',
    company: 'GitLab',
  }).jobs;
  const canonical = normalizeGreenhouseResponse(loadFixture('greenhouse-canonical.json'), {
    board: 'canonical',
    company: 'Canonical',
  }).jobs;

  it('normalizes every listing, with board-scoped ids', () => {
    expect(gitlab).toHaveLength(6);
    expect(canonical).toHaveLength(3);
    expectValid([...gitlab, ...canonical]);
    expect(byTitle(gitlab, 'Account Executive - France')).toMatchObject({
      id: 'greenhouse:gitlab:8860302002',
      source_job_id: 'gitlab:8860302002',
      company: 'GitLab',
      url: 'https://job-boards.greenhouse.io/gitlab/jobs/8860302002',
      published_at: '2026-10-02T15:31:50.000Z', // first_published, converted to UTC
    });
  });

  it('decodes the entity-escaped content into HTML', () => {
    const { description } = byTitle(gitlab, 'Account Executive - France');
    expect(description.startsWith('<p>GitLab is')).toBe(true);
    expect(description).not.toContain('&lt;');
  });

  it('derives remote scope from the location text only', () => {
    expect(byTitle(gitlab, 'Associate Renewals').remote_scope).toBe('Americas'); // Remote, Canada; Remote, US
    expect(byTitle(gitlab, 'Backend Engineer').remote_scope).toBe('Europe'); // Remote, United Kingdom
    expect(byTitle(gitlab, 'Benefits Analyst').remote_scope).toBe('On-site'); // Bangalore, India
    expect(byTitle(gitlab, 'Commercial Account Executive').remote_scope).toBe('Unknown'); // Remote
  });

  it('understands Canonical\'s "Home based" as remote', () => {
    expect(byTitle(canonical, 'Alliances Field Engineer').remote_scope).toBe('Worldwide');
    expect(byTitle(canonical, 'Accountant').remote_scope).toBe('Multi-region'); // EMEA
  });
});

describe('Lever', () => {
  const spotify = normalizeLeverResponse(loadFixture('lever-spotify.json'), {
    board: 'spotify',
    company: 'Spotify',
  }).jobs;
  const offchain = normalizeLeverResponse(loadFixture('lever-offchainlabs.json'), {
    board: 'offchainlabs',
    company: 'Offchain Labs',
  }).jobs;

  it('normalizes every posting', () => {
    expect(spotify).toHaveLength(6);
    expect(offchain).toHaveLength(2);
    expectValid([...spotify, ...offchain]);
  });

  it('uses workplaceType (live value "onsite", docs say "on-site") for remote vs on-site', () => {
    expect(byTitle(spotify, 'Client Partner').remote_scope).toBe('On-site'); // hybrid
    expect(byTitle(spotify, 'Fraud Analyst').remote_scope).toBe('On-site'); // onsite
  });

  it('falls back to the country code when the location names no region', () => {
    expect(byTitle(spotify, 'Director of Engineering').remote_scope).toBe('Europe'); // London; Stockholm, GB
    expect(byTitle(offchain, 'Senior Backend Engineer').remote_scope).toBe('US only'); // "Remote", US
  });

  it('maps commitment labels, including "Full Time Contractor"', () => {
    expect(byTitle(spotify, 'Client Partner').employment_type).toBe('full_time'); // Permanent
    expect(byTitle(spotify, 'Fraud Analyst').employment_type).toBe('contract'); // Full Time Contractor
    expect(byTitle(spotify, 'Artist & Label').employment_type).toBe('contract'); // Short Term
  });

  it('formats salaryRange and joins the description with its lists', () => {
    const job = byTitle(offchain, 'Senior Backend Engineer');
    expect(job.salary).toBe('USD 193,461–291,000 per year');
    expect(job.description).toMatch(/<h3>[^<]+<\/h3><ul><li>/);
    expect(job.published_at).toBe('2026-09-23T21:16:52.687Z'); // createdAt in ms
  });
});

describe('Ashby', () => {
  const linear = normalizeAshbyResponse(loadFixture('ashby-linear.json'), {
    board: 'linear',
    company: 'Linear',
  });
  const posthog = normalizeAshbyResponse(loadFixture('ashby-posthog.json'), {
    board: 'posthog',
    company: 'PostHog',
  });

  it('normalizes every listed job', () => {
    expect(linear.jobs).toHaveLength(4);
    expect(posthog.jobs).toHaveLength(4);
    expectValid([...linear.jobs, ...posthog.jobs]);
  });

  it('includes secondary locations', () => {
    const job = byTitle(linear.jobs, 'Developer Relations');
    expect(job.location).toBe('North America; Europe');
    expect(job.remote_scope).toBe('Multi-region');
  });

  it('trusts workplaceType over secondary "Remote" locations', () => {
    expect(byTitle(posthog.jobs, 'Site Reliability Engineer').remote_scope).toBe('On-site');
    expect(byTitle(posthog.jobs, 'AI Research Engineer').remote_scope).toBe('On-site'); // Hybrid
  });

  it('uses the address only when it names a region, not a single country', () => {
    // location "Remote", addressCountry "USA" (likely the company's address) → still Unknown
    expect(byTitle(posthog.jobs, 'Product Engineer').remote_scope).toBe('Unknown');
  });

  it('skips unlisted jobs without counting them as invalid', () => {
    const [first] = (loadFixture('ashby-linear.json') as { jobs: unknown[] }).jobs;
    const result = normalizeAshbyResponse(
      { jobs: [{ ...(first as object), isListed: false }, { title: 'broken' }] },
      { board: 'linear', company: 'Linear' },
    );
    expect(result).toMatchObject({ jobs: [], unlisted: 1, skipped: 1 });
  });
});

describe('Greenhouse titles with an embedded location', () => {
  it('strips "| Country | Remote" so per-country copies share a title (and dedupe)', () => {
    const raw = (loadFixture('greenhouse-gitlab.json') as { jobs: Record<string, unknown>[] })
      .jobs[0];
    const copies = ['Sweden', 'Germany'].map((country, i) => ({
      ...raw,
      id: i + 1,
      title: `Senior Software Engineer, Security Assurance | ${country} | Remote`,
      location: { name: `${country} (Remote)` },
    }));
    const { jobs } = normalizeGreenhouseResponse(
      { jobs: copies },
      { board: 'grafanalabs', company: 'Grafana Labs' },
    );
    expect(jobs.map((job) => [job.title, job.location, job.remote_scope])).toEqual([
      ['Senior Software Engineer, Security Assurance', 'Sweden (Remote)', 'Europe'],
      ['Senior Software Engineer, Security Assurance', 'Germany (Remote)', 'Europe'],
    ]);
  });
});
