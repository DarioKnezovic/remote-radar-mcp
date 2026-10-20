import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FileProfileStore, resolveProfileFile } from '../../src/profile/profile-store.js';
import { createServer } from '../../src/server.js';
import { JobSearchService } from '../../src/services/job-search.js';
import type { ProfileStore } from '../../src/profile/profile-store.js';
import type { TrackerStore } from '../../src/tools/shared.js';
import { makeJob, makeProfile, staticProfiles, unusedStore } from '../helpers.js';

describe('FileProfileStore', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'remote-radar-profile-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts the committed example profile', async () => {
    const result = await new FileProfileStore(
      new URL('../../profile.example.json', import.meta.url),
    ).load();
    expect(result.ok).toBe(true);
  });

  it('explains how to create a missing profile', async () => {
    const result = await new FileProfileStore(pathToFileURL(join(dir, 'nope.json'))).load();
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('Copy profile.example.json to profile.json') as string,
    });
  });

  it('reports schema problems by field, and normalizes country codes', async () => {
    const bad = join(dir, 'bad.json');
    await writeFile(
      bad,
      JSON.stringify({ location: { country: 'X' }, citizenship: [], skills: {} }),
    );
    const invalid = await new FileProfileStore(pathToFileURL(bad)).load();
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && invalid.error).toMatch(/location\.country_code.*citizenship/);

    const good = join(dir, 'good.json');
    await writeFile(
      good,
      JSON.stringify({
        location: { country: 'Croatia', country_code: 'hr', timezone: 'CET' },
        citizenship: ['hr'],
        skills: { strong: ['TypeScript'] },
      }),
    );
    const loaded = await new FileProfileStore(pathToFileURL(good)).load();
    expect(loaded.ok && loaded.profile).toMatchObject({
      location: { country_code: 'HR' },
      citizenship: ['HR'],
      skills: { strong: ['TypeScript'], some: [], learning: [] },
      years_experience: null,
      stories: [],
    });
  });

  it('saves a valid profile (creating the folder) and loads it back normalized', async () => {
    const store = new FileProfileStore(pathToFileURL(join(dir, 'new', 'profile.json')));
    const saved = await store.save({
      location: { country: 'Croatia', country_code: 'hr', timezone: 'CET' },
      citizenship: ['hr'],
      skills: { strong: ['TypeScript'] },
    });
    expect(saved.ok).toBe(true);
    const loaded = await store.load();
    expect(loaded.ok && loaded.profile).toMatchObject({
      location: { country_code: 'HR' },
      skills: { strong: ['TypeScript'], some: [], learning: [] },
    });
    expect(await readdir(join(dir, 'new'))).toEqual(['profile.json']); // no temp file left
  });

  it('refuses an invalid profile with per-field issues, leaving the file untouched', async () => {
    const file = join(dir, 'keep.json');
    const store = new FileProfileStore(pathToFileURL(file));
    await store.save(makeProfile());
    const before = await readFile(file, 'utf8');

    const result = await store.save({ ...makeProfile(), citizenship: [], years_experience: -1 });

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { path: 'citizenship', message: expect.any(String) as string },
        { path: 'years_experience', message: expect.any(String) as string },
      ],
    });
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('honours PROFILE_FILE', () => {
    expect(resolveProfileFile({ PROFILE_FILE: '/tmp/me.json' }).pathname).toBe('/tmp/me.json');
    expect(resolveProfileFile({}).pathname).toMatch(/\/profile\.json$/);
  });
});

describe('get_profile and match_job tools', () => {
  let client: Client | undefined;
  afterEach(async () => {
    await client?.close();
  });

  const job = makeJob({
    title: 'Senior React Engineer',
    remote_scope: 'EU only',
    location: 'EU',
    description: '<p>React and TypeScript. Fluent German required.</p>',
  });
  const store: TrackerStore = {
    ...unusedStore,
    getJob: (id) => Promise.resolve(id === job.id ? job : undefined),
  };

  async function connect(profiles: ProfileStore) {
    const server = createServer({ search: new JobSearchService([]), store, profiles });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0' });
    await Promise.all([server.connect(b), client.connect(a)]);
    return client;
  }

  it('get_profile returns the profile', async () => {
    const c = await connect(staticProfiles(makeProfile()));
    const result = await c.callTool({ name: 'get_profile', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      profile: { citizenship: ['HR'], location: { country_code: 'BA' } },
    });
  });

  it('get_profile surfaces a missing profile as a tool error', async () => {
    const c = await connect(staticProfiles('No profile at /x. Copy profile.example.json …'));
    const result = await c.callTool({ name: 'get_profile', arguments: {} });
    expect(result.isError).toBe(true);
  });

  it('match_job returns skills, red flags and notes for a job', async () => {
    const c = await connect(staticProfiles(makeProfile()));
    const result = await c.callTool({ name: 'match_job', arguments: { job_id: job.id } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      job: { id: job.id, title: 'Senior React Engineer', url: job.url },
      matched_skills: [
        { skill: 'TypeScript', level: 'strong' },
        { skill: 'React', level: 'strong' },
      ],
      missing_skills: [],
      skill_coverage: 1,
      red_flags: [
        { code: 'region_restricted' },
        { code: 'language_required', evidence: 'Fluent German required.' },
      ],
    });
  });

  it('match_job explains unknown job ids and missing profiles', async () => {
    const c = await connect(staticProfiles('No profile'));
    const unknown = await c.callTool({ name: 'match_job', arguments: { job_id: 'remotive:404' } });
    expect(JSON.stringify(unknown.content)).toContain('run a search first');
    const noProfile = await c.callTool({ name: 'match_job', arguments: { job_id: job.id } });
    expect(JSON.stringify(noProfile.content)).toContain('No profile');
  });
});
