import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobRepository } from '../../src/db/job-repository.js';
import { PostgresFetchCacheStore } from '../../src/db/postgres-fetch-cache-store.js';
import { createServer } from '../../src/server.js';
import { JobSearchService } from '../../src/services/job-search.js';
import { CachedJobSource } from '../../src/sources/cache.js';
import { FakeSource, makeJob, unusedProfiles } from '../helpers.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from './db.js';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-10-20T12:00:00.000Z');

/** End-to-end: MCP client → server → tools → repository → Postgres. Only the job source is fake. */
describe.skipIf(!TEST_DATABASE_URL)('tracker tools (MCP + Postgres)', () => {
  let db: TestDatabase;
  let client: Client;
  let source: FakeSource;

  const react = makeJob({
    title: 'Senior React Engineer',
    company: 'Acme',
    description: '<p>React &amp; <b>TypeScript</b>.</p><ul><li>Remote</li></ul>',
  });
  const angular = makeJob({
    title: 'Angular Lead',
    company: 'Globex',
    tags: ['angular'],
    description: '<p>Angular and RxJS.</p>',
  });

  function connect(): Promise<Client> {
    const repository = new JobRepository(db.pool, () => NOW);
    const cached = new CachedJobSource(source, new PostgresFetchCacheStore(repository), {
      ttlMs: HOUR_MS,
      retryAfterMs: HOUR_MS,
      now: () => NOW.getTime(),
    });
    const server = createServer({
      search: new JobSearchService([cached], () => NOW),
      store: repository,
      profiles: unusedProfiles,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: 'test-client', version: '0.0.0' });
    return Promise.all([server.connect(serverTransport), c.connect(clientTransport)]).then(() => c);
  }

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    return result as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content: { text: string }[];
    };
  }

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    await db.reset();
    source = new FakeSource([react, angular]);
    client = await connect();
    await call('search_jobs'); // populates the jobs table, as in real use
  });
  afterEach(async () => {
    await client.close();
  });

  it('search results persist, so a restarted server does not refetch the source', async () => {
    await client.close();
    client = await connect();

    const result = await call('search_jobs', { query: 'react' });

    expect(source.calls).toBe(1);
    expect(result.structuredContent).toMatchObject({ jobs: [{ id: react.id }] });
  });

  it('get_job_details returns the full job with a plain-text description', async () => {
    const result = await call('get_job_details', { job_id: react.id });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      job: {
        id: react.id,
        title: 'Senior React Engineer',
        url: react.url,
        description: 'React & TypeScript.\nRemote',
      },
      saved: null,
      cover_letter: null,
      attribution: expect.stringContaining('Remotive') as string,
    });
  });

  it('get_job_details includes the cover letter draft saved in the web app', async () => {
    await new JobRepository(db.pool, () => NOW).saveCoverLetter(react.id, 'Dear Acme team,');

    const result = await call('get_job_details', { job_id: react.id });

    expect(result.structuredContent).toMatchObject({
      cover_letter: { body: 'Dear Acme team,', updated_at: NOW.toISOString() },
    });
  });

  it('get_job_details explains unknown ids', async () => {
    const result = await call('get_job_details', { job_id: 'remotive:404' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('run a search first');
  });

  it('save → update → list: the full tracking flow', async () => {
    const saved = await call('save_job', { job_id: react.id, notes: 'Great stack match' });
    expect(saved.structuredContent).toMatchObject({
      created: true,
      saved: { job_id: react.id, status: 'found', company: 'Acme' },
    });

    const updated = await call('update_job_status', {
      job_id: react.id,
      status: 'applied',
      notes: 'Applied on their site',
    });
    expect(updated.structuredContent).toMatchObject({
      previous_status: 'found',
      saved: {
        status: 'applied',
        notes: '[2026-10-20 found] Great stack match\n[2026-10-20 applied] Applied on their site',
      },
    });

    await call('save_job', { job_id: angular.id });

    const all = await call('list_saved_jobs');
    expect(all.structuredContent).toMatchObject({ count: 2 });
    const applied = await call('list_saved_jobs', { status: 'applied' });
    expect(applied.structuredContent).toMatchObject({
      count: 1,
      jobs: [{ job_id: react.id, status: 'applied' }],
    });

    const details = await call('get_job_details', { job_id: react.id });
    expect(details.structuredContent).toMatchObject({ saved: { status: 'applied' } });
  });

  it('save_job rejects ids that never came from a search', async () => {
    const result = await call('save_job', { job_id: 'arbeitnow:made-up' });
    expect(result.isError).toBe(true);
  });

  it('update_job_status asks to save first', async () => {
    const result = await call('update_job_status', { job_id: react.id, status: 'applied' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('save_job');
  });

  it('rejects statuses outside the allowed set', async () => {
    await call('save_job', { job_id: react.id });
    const result = await call('update_job_status', { job_id: react.id, status: 'hired' });
    expect(result.isError).toBe(true);
  });
});
