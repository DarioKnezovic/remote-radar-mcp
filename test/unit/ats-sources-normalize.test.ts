import { describe, expect, it } from 'vitest';
import { jobSchema, type Job } from '../../src/domain/job.js';
import { parseSalary } from '../../src/domain/salary.js';
import { normalizeRecruiteeResponse } from '../../src/sources/recruitee/normalize.js';
import {
  normalizeSmartRecruitersDetail,
  smartRecruitersPostingIds,
} from '../../src/sources/smartrecruiters/normalize.js';
import { normalizeWorkableResponse } from '../../src/sources/workable/normalize.js';
import { loadFixture } from '../helpers.js';

// All fixtures: trimmed samples recorded 2026-10-21 (see test/fixtures/README.md).

function byTitle(jobs: Job[], prefix: string): Job {
  const job = jobs.find((j) => j.title.startsWith(prefix));
  if (!job) throw new Error(`no fixture job starting with "${prefix}"`);
  return job;
}

function expectValid(jobs: Job[]) {
  for (const job of jobs) expect(() => jobSchema.parse(job)).not.toThrow();
}

describe('Recruitee', () => {
  const codest = normalizeRecruiteeResponse(loadFixture('recruitee-thecodest.json'), {
    board: 'thecodest',
    company: 'The Codest',
  });
  const curotec = normalizeRecruiteeResponse(loadFixture('recruitee-curotec.json'), {
    board: 'curotec',
    company: 'Curotec',
  }).jobs;
  const channable = normalizeRecruiteeResponse(loadFixture('recruitee-channable.json'), {
    board: 'channable',
    company: 'Channable',
  }).jobs;

  it('normalizes every offer, with board-scoped ids and the careers page link', () => {
    expect(codest.jobs).toHaveLength(5);
    expect(codest.skipped).toBe(0);
    expect(curotec).toHaveLength(3);
    expect(channable).toHaveLength(3);
    expectValid([...codest.jobs, ...curotec, ...channable]);
    expect(byTitle(codest.jobs, 'Senior Backend Engineer (Python)')).toMatchObject({
      id: 'recruitee:thecodest:2791872',
      source: 'recruitee',
      company: 'The Codest',
      url: 'https://thecodest.recruitee.com/o/senior-backend-engineer-python-full-stack-mindset',
      published_at: '2026-10-21T07:58:33.000Z', // "2026-10-21 07:58:33 UTC"
      tags: ['Development', 'Senior'],
    });
  });

  it('reads the remote countries from `locations` ("Remote job" says nothing)', () => {
    expect(byTitle(codest.jobs, 'Senior Backend Engineer')).toMatchObject({
      location: 'Remote: Poland',
      remote_scope: 'Europe',
    });
    expect(byTitle(channable, 'Account Executive - North America')).toMatchObject({
      location: 'Remote: United States',
      remote_scope: 'US only',
    });
    expect(byTitle(curotec, 'AI Platform Engineer').remote_scope).toBe('Americas');
  });

  it('treats hybrid and on-site offers as on-site, keeping their city', () => {
    expect(byTitle(codest.jobs, 'Senior React Developer')).toMatchObject({
      location: 'Kraków, Małopolskie, Poland',
      remote_scope: 'On-site',
    });
    expect(byTitle(curotec, 'Revenue Marketing Manager').remote_scope).toBe('On-site');
  });

  it('formats the salary range so the salary filter can read it', () => {
    const monthly = byTitle(codest.jobs, 'Senior Backend Engineer').salary;
    expect(monthly).toBe('PLN 20,000–26,000 per month');
    expect(parseSalary(monthly)).toEqual({
      min: 20_000,
      max: 26_000,
      currency: 'PLN',
      period: 'month',
    });
    expect(byTitle(channable, 'Team Lead').salary).toBe('EUR 77,000–103,000 per year');
    // A currency without amounts, or no salary at all, is not a salary.
    expect(byTitle(codest.jobs, 'Business Development Manager').salary).toBeNull();
    expect(byTitle(codest.jobs, 'Senior Data Engineer').salary).toBeNull();
  });

  it('maps employment type codes, part-time before "permanent"', () => {
    expect(byTitle(codest.jobs, 'Senior Platform Engineer').employment_type).toBe('contract');
    expect(byTitle(codest.jobs, 'Senior React Developer').employment_type).toBe('full_time');
    const partTime = normalizeRecruiteeResponse(
      {
        offers: [
          {
            id: 1,
            title: 'Support Agent',
            careers_url: 'https://acme.recruitee.com/o/support-agent',
            employment_type_code: 'parttime_permanent',
            created_at: '2026-10-01 08:00:00 UTC',
          },
        ],
      },
      { board: 'acme', company: 'Acme' },
    ).jobs;
    expect(partTime[0]?.employment_type).toBe('part_time');
    expect(partTime[0]?.description).toBe(''); // no description, no requirements heading
  });

  it('appends the requirements to the description', () => {
    const { description } = byTitle(codest.jobs, 'Senior Data Engineer');
    expect(description).toContain('<h3>Requirements</h3>');
  });
});

describe('Workable', () => {
  const blueground = normalizeWorkableResponse(loadFixture('workable-blueground.json'), {
    board: 'blueground',
    company: 'Blueground',
  }).jobs;
  const epignosis = normalizeWorkableResponse(loadFixture('workable-epignosis.json'), {
    board: 'epignosis',
    company: 'Epignosis',
  });

  it('normalizes every job, with board-scoped ids', () => {
    expect(blueground).toHaveLength(3);
    expectValid([...blueground, ...epignosis.jobs]);
    expect(byTitle(blueground, 'Sales Admin On-Demand')).toMatchObject({
      id: 'workable:blueground:407973D643',
      source: 'workable',
      company: 'Blueground',
      url: 'https://apply.workable.com/j/407973D643',
      published_at: '2026-10-13T00:00:00.000Z', // a date only
    });
  });

  it('merges a job listed once per city into one job with every city', () => {
    expect(epignosis.jobs).toHaveLength(2);
    expect(epignosis.merged).toBe(1);
    expect(epignosis.skipped).toBe(0);
    expect(byTitle(epignosis.jobs, 'Senior Software Engineer').location).toBe(
      'Athens, Greece; Heraklion, Greece',
    );
  });

  it('uses the remote flag, with the countries as the location', () => {
    expect(byTitle(blueground, 'Sales Admin On-Demand')).toMatchObject({
      location: 'Remote: Brazil',
      remote_scope: 'Americas',
    });
    expect(byTitle(blueground, 'Senior Software Engineer, iOS')).toMatchObject({
      location: 'Athens, Greece',
      remote_scope: 'On-site',
    });
  });

  it('reads the employment type, and leaves an empty one unknown', () => {
    expect(byTitle(blueground, 'Maintenance Technician').employment_type).toBe('full_time');
    expect(byTitle(epignosis.jobs, 'Software Engineer (React Native)').employment_type).toBe(
      'unknown',
    );
  });
});

describe('SmartRecruiters', () => {
  const details = loadFixture('smartrecruiters-canva-details.json') as Record<string, unknown>;
  const ids = smartRecruitersPostingIds(loadFixture('smartrecruiters-canva.json'));
  const jobs = ids
    .map((id) => normalizeSmartRecruitersDetail(details[id], { board: 'Canva', company: 'Canva' }))
    .filter((job): job is Job => job !== null);

  it('lists posting ids, and normalizes each detail with its public link', () => {
    expect(ids).toHaveLength(4);
    expect(jobs).toHaveLength(4);
    expectValid(jobs);
    expect(byTitle(jobs, 'Senior Backend Engineer')).toMatchObject({
      id: 'smartrecruiters:Canva:6000000001468836',
      source: 'smartrecruiters',
      url: 'https://jobs.smartrecruiters.com/Canva/6000000001468836-senior-backend-engineer-export',
      published_at: '2026-10-07T04:48:31.149Z',
      tags: ['Information Technology'],
    });
  });

  it('cleans up the location and reads the scope from it', () => {
    expect(byTitle(jobs, 'Senior Backend Engineer')).toMatchObject({
      location: 'Remote: Sydney, Australia', // "Sydney, , Australia"
      remote_scope: 'Other',
    });
    expect(byTitle(jobs, 'Strategic Account Executive').remote_scope).toBe('Europe');
    expect(byTitle(jobs, 'Country Manager, Argentina').remote_scope).toBe('Americas');
  });

  it('joins the non-empty job ad sections under their headings', () => {
    const { description } = byTitle(jobs, 'Senior Backend Engineer');
    expect(description.startsWith('<h3>Job Description</h3>')).toBe(true);
    expect(description).not.toContain('Qualifications'); // empty section
  });

  it('reads the employment type', () => {
    expect(byTitle(jobs, 'Template Art Director').employment_type).toBe('contract');
    expect(byTitle(jobs, 'Senior Backend Engineer').employment_type).toBe('full_time');
  });

  it('skips a detail without the fields a job needs', () => {
    expect(normalizeSmartRecruitersDetail({ id: '1' }, { board: 'Canva', company: 'Canva' })).toBe(
      null,
    );
  });
});
