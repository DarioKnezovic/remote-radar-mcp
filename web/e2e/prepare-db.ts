/**
 * Recreates the e2e database and fills it with the demo jobs, before the app starts.
 * Run by Playwright's webServer command, so the database exists for the first request.
 */
import pg from 'pg';
import { E2E_DATABASE_URL, resetDemoData } from './env';

const name = new URL(E2E_DATABASE_URL).pathname.slice(1);
if (!/^[a-z0-9_]*demo[a-z0-9_]*$/.test(name)) {
  throw new Error(`Refusing to recreate "${name}": use a database whose name contains "demo".`);
}

const admin = new URL(E2E_DATABASE_URL);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.href });
await client.connect();
try {
  await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await client.query(`CREATE DATABASE ${name}`);
} finally {
  await client.end();
}

await resetDemoData();
