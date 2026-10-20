import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from './db.js';

describe.skipIf(!TEST_DATABASE_URL)('migrate (Postgres)', () => {
  let db: TestDatabase;
  let dir: string;

  beforeAll(async () => {
    db = await createTestDatabase(); // already ran the real 001_init.sql
    dir = await mkdtemp(join(tmpdir(), 'remote-radar-migrations-'));
  });
  afterAll(async () => {
    await db.drop();
    await rm(dir, { recursive: true, force: true });
  });

  const dirUrl = () => pathToFileURL(`${dir}/`);

  it('rolls back a failing migration completely and does not record it', async () => {
    await writeFile(
      join(dir, '900_broken.sql'),
      'CREATE TABLE half_done (id int);\nSELECT * FROM table_that_does_not_exist;',
    );

    await expect(migrate(db.pool, dirUrl())).rejects.toThrow(/900_broken\.sql failed/);

    const { rows } = await db.pool.query<{ table: string | null; recorded: boolean }>(
      `SELECT to_regclass('half_done')::text AS table,
              EXISTS (SELECT 1 FROM schema_migrations WHERE name = '900_broken.sql') AS recorded`,
    );
    expect(rows[0]).toEqual({ table: null, recorded: false });
  });

  it('applies new files in numeric order and ignores non-migration files', async () => {
    await rm(join(dir, '900_broken.sql'));
    await writeFile(join(dir, '902_second.sql'), 'ALTER TABLE first_table ADD COLUMN extra int;');
    await writeFile(join(dir, '901_first.sql'), 'CREATE TABLE first_table (id int);');
    await writeFile(join(dir, 'notes.txt'), 'not a migration');

    expect(await migrate(db.pool, dirUrl())).toEqual(['901_first.sql', '902_second.sql']);
    expect(await migrate(db.pool, dirUrl())).toEqual([]);
  });
});
