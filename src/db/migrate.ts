import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { logger } from '../logger.js';

/** `migrations/` at the package root; resolves the same from `src/db/` and `dist/db/`. */
export const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

/** Arbitrary constant so concurrent server starts don't run migrations twice. */
const MIGRATION_LOCK_ID = 7_316_402;

/**
 * Applies `NNN_name.sql` files in order, each in its own transaction, and records
 * them in `schema_migrations`. Already-applied files are skipped, so this is safe
 * to run on every start.
 */
export async function migrate(pool: Pool, dir: URL = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(new URL(file, dir), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      applied.push(file);
      logger.info('applied migration', { file });
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
