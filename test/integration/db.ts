import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../../src/db/migrate.js';
import { createPool } from '../../src/db/pool.js';

/** Integration tests run only when this is set (`npm run test:db`, and in CI). */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export interface TestDatabase {
  pool: pg.Pool;
  schema: string;
  /** Empties every table between tests. */
  reset(): Promise<void>;
  drop(): Promise<void>;
}

/**
 * Creates a throwaway schema, points a pool at it via search_path and runs the real
 * migrations. Each test file gets its own schema, so files can run in parallel.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  const schema = `test_${randomUUID().replace(/-/g, '')}`;

  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const pool = createPool(TEST_DATABASE_URL, { options: `-c search_path=${schema}` });
  await migrate(pool);

  return {
    pool,
    schema,
    async reset() {
      await pool.query(
        'TRUNCATE jobs, saved_jobs, job_status_history, source_fetches RESTART IDENTITY CASCADE',
      );
    },
    async drop() {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    },
  };
}
