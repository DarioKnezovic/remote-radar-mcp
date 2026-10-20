import { readFileSync } from 'node:fs';
import type { Job } from '../src/domain/job.js';
import type { Profile } from '../src/domain/profile.js';
import type { ProfileStore } from '../src/profile/profile-store.js';
import type { JobSource, SourceInfo } from '../src/sources/job-source.js';
import type { TrackerStore } from '../src/tools/shared.js';

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

let counter = 0;

/** A valid job with sensible defaults; override only what a test cares about. */
export function makeJob(overrides: Partial<Job> = {}): Job {
  counter++;
  const sourceJobId = overrides.source_job_id ?? String(counter);
  const source = overrides.source ?? 'remotive';
  return {
    id: `${source}:${sourceJobId}`,
    source,
    source_job_id: sourceJobId,
    url: `https://example.com/jobs/${sourceJobId}`,
    title: 'Senior Frontend Engineer',
    company: 'Acme',
    location: 'Worldwide',
    remote_scope: 'Worldwide',
    employment_type: 'full_time',
    salary: null,
    tags: ['react', 'typescript'],
    description: '<p>Build things with React and TypeScript.</p>',
    published_at: '2026-10-15T12:00:00.000Z',
    ...overrides,
  };
}

/** In-memory {@link JobSource} for tests: returns fixed jobs or throws a fixed error. */
export class FakeSource implements JobSource {
  calls = 0;

  constructor(
    private readonly result: Job[] | Error,
    readonly info: SourceInfo = { id: 'remotive', name: 'Fake', homepage: 'https://fake.test' },
  ) {}

  fetchJobs(): Promise<Job[]> {
    this.calls++;
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

function notInThisTest(): never {
  throw new Error('store not used in this test');
}

/** For tests that only exercise search_jobs. */
export const unusedStore: TrackerStore = {
  getJob: notInThisTest,
  getSavedJob: notInThisTest,
  saveJob: notInThisTest,
  updateStatus: notInThisTest,
  listSavedJobs: notInThisTest,
};

/** A valid profile resembling the project owner's situation: EU citizen living outside the EU. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    location: {
      city: 'Mostar',
      country: 'Bosnia and Herzegovina',
      country_code: 'BA',
      timezone: 'CET',
    },
    citizenship: ['HR'],
    years_experience: 8,
    skills: {
      strong: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      some: ['Rust', 'Vue.js'],
      learning: ['Python'],
    },
    languages: ['English', 'Croatian'],
    looking_for: { roles: ['Full-stack engineer'], employment_types: ['full_time', 'contract'] },
    stories: [],
    ...overrides,
  };
}

/** ProfileStore that returns a fixed profile, or a fixed error. */
export function staticProfiles(result: Profile | string): ProfileStore {
  return {
    load: () =>
      Promise.resolve(
        typeof result === 'string'
          ? { ok: false as const, error: result }
          : { ok: true as const, profile: result, file: '/test/profile.json' },
      ),
  };
}

export const unusedProfiles: ProfileStore = { load: notInThisTest };
