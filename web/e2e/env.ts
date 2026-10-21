import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Its name contains "demo", which the seed script requires. Recreated on every run. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgres://remote_radar:remote_radar@localhost:5433/remote_radar_demo_e2e';

/** The app's profile.json during the tests (git-ignored), never your own. */
export const PROFILE_FILE = fileURLToPath(new URL('.tmp/profile.json', import.meta.url));

const EXAMPLE_PROFILE = fileURLToPath(new URL('../../profile.example.json', import.meta.url));
const DEMO_SEED = fileURLToPath(new URL('../../scripts/demo-seed.ts', import.meta.url));

/**
 * Empties the e2e database and fills it with the demo jobs and saved jobs again, so every
 * test starts from the same state (and a retry doesn't see the first attempt's changes).
 */
export async function resetDemoData(): Promise<void> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    // Before the first seed the tables don't exist yet; the seed creates them.
    await client.query(`DO $$ BEGIN
      IF to_regclass('jobs') IS NOT NULL THEN
        TRUNCATE jobs, saved_jobs, job_status_history, cover_letters, source_fetches;
      END IF;
    END $$`);
  } finally {
    await client.end();
  }
  execFileSync('npx', ['tsx', DEMO_SEED], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
}

/** Starts a test with the fictional example profile (Serbia, React and TypeScript). */
export async function useExampleProfile(): Promise<void> {
  await mkdir(dirname(PROFILE_FILE), { recursive: true });
  await writeFile(PROFILE_FILE, await readFile(EXAMPLE_PROFILE));
}

/** Starts a test as a first-time user. */
export async function useNoProfile(): Promise<void> {
  await mkdir(dirname(PROFILE_FILE), { recursive: true });
  await rm(PROFILE_FILE, { force: true });
}
