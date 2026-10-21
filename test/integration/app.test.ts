import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRemoteRadar, type RemoteRadar } from '../../src/app.js';
import { HttpError, type HttpClient } from '../../src/sources/http.js';
import { makeProfile } from '../helpers.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from './db.js';

/** No network in tests: every job API is "down". */
const offline: HttpClient = {
  getJson: (url) => Promise.reject(new HttpError(url, 503, 'Service Unavailable')),
};

/** The wiring both entry points (MCP server and web app) use. */
describe.skipIf(!TEST_DATABASE_URL)('createRemoteRadar', () => {
  let db: TestDatabase;
  let dir: string;
  let app: RemoteRadar;

  beforeAll(async () => {
    db = await createTestDatabase();
    dir = await mkdtemp(join(tmpdir(), 'remote-radar-app-'));
    app = await createRemoteRadar({
      pool: db.pool,
      http: offline,
      env: { PROFILE_FILE: join(dir, 'profile.json') },
    });
  });
  afterAll(async () => {
    await app.close();
    await db.drop(); // still works: close() leaves a passed-in pool open
    await rm(dir, { recursive: true, force: true });
  });

  it('enables every source, with the default company boards', () => {
    expect(app.sources.map((s) => s.id)).toEqual([
      'remotive',
      'arbeitnow',
      'remoteok',
      'greenhouse',
      'lever',
      'ashby',
      'workable',
      'smartrecruiters',
      'recruitee',
    ]);
    expect(app.boardsFile).toMatch(/boards(\.default)?\.json$/);
  });

  it('reports failing sources instead of throwing', async () => {
    const result = await app.search.search({ limit: 5 });
    expect(result.jobs).toEqual([]);
    expect(result.sources.every((s) => !s.ok)).toBe(true);
  });

  it('saves and loads the profile from PROFILE_FILE', async () => {
    expect((await app.profiles.load()).ok).toBe(false);
    expect((await app.profiles.save(makeProfile())).ok).toBe(true);
    expect(await app.profiles.load()).toMatchObject({ ok: true, profile: { citizenship: ['HR'] } });
  });

  it('uses the given database for the tracker', async () => {
    expect(await app.tracker.listSavedJobs()).toEqual([]);
  });
});

describe('createRemoteRadar without a database', () => {
  it('explains how to start Postgres, with the real reason', async () => {
    await expect(
      createRemoteRadar({ env: { DATABASE_URL: 'postgres://x:x@127.0.0.1:1/x' }, http: offline }),
    ).rejects.toThrow(
      /^Cannot prepare the database \(connect ECONNREFUSED 127\.0\.0\.1:1\)\. Is Postgres running\?/,
    );
  });
});
