import { describe, expect, it } from 'vitest';
import { jobSchema } from '../../src/domain/job.js';
import {
  mapEmploymentType,
  normalizeArbeitnowResponse,
  remoteScopeFor,
} from '../../src/sources/arbeitnow/normalize.js';
import { loadFixture } from '../helpers.js';

// Trimmed sample of page 1 from https://www.arbeitnow.com/api/job-board-api (2026-10-20).
const fixture = loadFixture('arbeitnow.json');

describe('normalizeArbeitnowResponse (recorded fixture)', () => {
  const { jobs, skipped, next } = normalizeArbeitnowResponse(fixture);
  const bySlugPrefix = (prefix: string) => {
    const job = jobs.find((j) => j.source_job_id.startsWith(prefix));
    if (!job) throw new Error(`no fixture job ${prefix}`);
    return job;
  };

  it('normalizes every listing into a valid Job', () => {
    expect(jobs).toHaveLength(17);
    expect(skipped).toBe(0);
    for (const job of jobs) expect(() => jobSchema.parse(job)).not.toThrow();
  });

  it('returns the next page link', () => {
    expect(next).toBe('https://www.arbeitnow.com/api/job-board-api?page=2');
  });

  it('maps the core fields of a listing', () => {
    expect(bySlugPrefix('customer-success-manager-ts24-essen')).toMatchObject({
      id: 'arbeitnow:customer-success-manager-ts24-essen-350534',
      source: 'arbeitnow',
      url: 'https://www.arbeitnow.com/jobs/companies/truckscout24/customer-success-manager-ts24-essen-350534',
      title: 'Customer Success Manager (m/w/d) TS24',
      company: 'TruckScout24',
      location: 'Essen',
      remote_scope: 'On-site',
      employment_type: 'full_time',
      salary: null,
      tags: ['Customer Service'],
      published_at: '2026-10-20T15:00:57.000Z',
    });
  });

  it('classifies remote listings by location, Unknown when it names no region', () => {
    expect(bySlugPrefix('remote-senior-lead-developer').remote_scope).toBe('Europe'); // "Germany"
    expect(bySlugPrefix('remote-software-engineer-front-end').remote_scope).toBe('Unknown'); // "Remote"
    expect(bySlugPrefix('systems-analyst').remote_scope).toBe('Unknown'); // "Berlin"
    expect(bySlugPrefix('remote-senior-uitvoerder').remote_scope).toBe('Unknown'); // "Werken op afstand"
  });

  it('moves a location embedded in the title into location, and detects remote from it', () => {
    // Raw: title "Staff Product Manager, … |  Germany | Remote", location "", remote: false
    expect(bySlugPrefix('staff-product-manager')).toMatchObject({
      title: 'Staff Product Manager, Enterprise Deployment Solutions',
      location: 'Germany, Remote',
      remote_scope: 'Europe',
    });
  });

  it('maps multilingual job_types to employment_type', () => {
    expect(bySlugPrefix('werkstudent-kommunikationsdesign').employment_type).toBe('part_time');
    expect(bySlugPrefix('founders-associate-intern').employment_type).toBe('internship');
    expect(bySlugPrefix('systems-analyst').employment_type).toBe('freelance');
    expect(bySlugPrefix('apporteur-daffaires').employment_type).toBe('freelance');
    expect(bySlugPrefix('commercial-btob-lille').employment_type).toBe('full_time'); // CDI
    expect(bySlugPrefix('head-of-transformation').employment_type).toBe('contract'); // Temporary
    expect(bySlugPrefix('remote-senior-lead-developer').employment_type).toBe('unknown'); // []
  });
});

describe('mapEmploymentType', () => {
  it.each([
    [['Full Time'], 'full_time'],
    [['fulltime fixed term'], 'full_time'],
    [['Unbefristeter arbeitsvertrag', 'berufserfahren'], 'full_time'],
    [['Indefinite contract (unbefristeter arbeitsvertrag)'], 'full_time'],
    [['Befristeter arbeitsvertrag'], 'contract'],
    [['Fixed-term contract'], 'contract'],
    [['Working student (werkstudent)'], 'part_time'],
    [['Teilzeit'], 'part_time'],
    [['Praktikum', 'Full Time'], 'internship'],
    [['Freelancer / indepedent contractor'], 'freelance'],
    [['Selbstständiger / freelancer'], 'freelance'],
    [['Mid', 'Experienced'], 'unknown'],
    [[], 'unknown'],
  ] as const)('%j → %s', (jobTypes, expected) => {
    expect(mapEmploymentType(jobTypes)).toBe(expected);
  });
});

describe('normalizeArbeitnowResponse (edge cases)', () => {
  const valid = {
    slug: 'dev-1',
    company_name: 'Co',
    title: 'Dev',
    url: 'https://www.arbeitnow.com/jobs/companies/co/dev-1',
    created_at: 1792500000,
  };

  it('skips invalid listings instead of failing the page', () => {
    const result = normalizeArbeitnowResponse({
      data: [
        valid,
        { slug: 'x', title: 'No url', created_at: 1 },
        { ...valid, created_at: 'soon' },
      ],
      links: { next: null },
    });
    expect(result.jobs.map((job) => job.id)).toEqual(['arbeitnow:dev-1']);
    expect(result.skipped).toBe(2);
    expect(result.next).toBeNull();
  });

  it('treats a missing remote flag and location as on-site', () => {
    const [job] = normalizeArbeitnowResponse({ data: [valid] }).jobs;
    expect(job).toMatchObject({ remote_scope: 'On-site', location: null, tags: [] });
  });

  it('throws when the envelope is wrong', () => {
    expect(() => normalizeArbeitnowResponse({ message: 'Too Many Attempts.' })).toThrow();
  });
});

describe('remoteScopeFor', () => {
  it('is On-site for non-remote listings', () => {
    expect(remoteScopeFor(false, 'Germany', 'Dev')).toBe('On-site');
  });

  it('uses the location first', () => {
    expect(remoteScopeFor(true, 'UK - Remote', 'Strategist (EU)')).toBe('Europe');
  });

  it('falls back to regions named in the title', () => {
    expect(remoteScopeFor(true, 'Remote job', 'Backend Developer .Net - Remote from EU')).toBe(
      'EU only',
    );
    expect(remoteScopeFor(true, 'Remote', 'Director Commercial Legal, EMEA')).toBe('Multi-region');
    expect(remoteScopeFor(true, 'Berlin', 'Sales Manager im Homeoffice deutschlandweit')).toBe(
      'Europe',
    );
  });

  it('does not read "Global" in a title as worldwide eligibility', () => {
    expect(remoteScopeFor(true, 'Remote', 'Global Head of Partnerships')).toBe('Unknown');
  });

  it('is Unknown when neither names a region', () => {
    expect(remoteScopeFor(true, 'Berlin', 'Software Engineer')).toBe('Unknown');
  });
});
