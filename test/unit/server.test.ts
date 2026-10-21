import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, SERVER_NAME, SERVER_VERSION } from '../../src/server.js';
import { JobSearchService } from '../../src/services/job-search.js';
import type { ProfileStore } from '../../src/profile/profile-store.js';
import type { JobSource } from '../../src/sources/job-source.js';
import {
  FakeSource,
  makeJob,
  makeProfile,
  noProfile,
  staticProfiles,
  unusedStore,
} from '../helpers.js';

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

async function connect(sources: JobSource[], profiles: ProfileStore = noProfile): Promise<Client> {
  const now = () => new Date('2026-10-20T12:00:00Z');
  const server = createServer({
    search: new JobSearchService(sources, now),
    store: unusedStore,
    profiles,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('MCP server', () => {
  it('completes the handshake and reports its identity', async () => {
    const c = await connect([]);
    expect(c.getServerVersion()).toEqual({ name: SERVER_NAME, version: SERVER_VERSION });
    expect(c.getInstructions()).toContain('never applies');
  });

  it('lists all tools', async () => {
    const c = await connect([]);
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_job_details',
      'get_profile',
      'list_saved_jobs',
      'match_job',
      'save_job',
      'search_jobs',
      'update_job_status',
    ]);
  });

  it('marks only the tracker-writing tools as non-read-only', async () => {
    const c = await connect([]);
    const { tools } = await c.listTools();
    const writers = tools.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name);
    expect(writers.sort()).toEqual(['save_job', 'update_job_status']);
  });

  it('exposes the search_jobs inputs from the spec', async () => {
    const c = await connect([]);
    const { tools } = await c.listTools();
    const tool = tools.find((t) => t.name === 'search_jobs');
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual([
      'query',
      'tags',
      'remote_scope',
      'posted_within_days',
      'min_salary',
      'salary_currency',
      'salary_listed_only',
      'limit',
    ]);
  });
});

describe('search_jobs tool', () => {
  it('returns filtered, deduped job summaries with attribution', async () => {
    const react = makeJob({ title: 'React Lead', company: 'Acme', salary: '$100k' });
    const c = await connect([
      new FakeSource([
        react,
        makeJob({ title: 'React Lead (Remote)', company: 'Acme Inc.' }),
        makeJob({ title: 'Python Dev', company: 'Globex', description: 'Django', tags: [] }),
      ]),
    ]);

    const result = await c.callTool({ name: 'search_jobs', arguments: { query: 'react' } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      total_matches: 1,
      duplicates_removed: 1,
      jobs: [
        {
          id: react.id,
          title: 'React Lead',
          url: react.url,
          source: 'remotive',
          salary: '$100k',
          snippet: 'Build things with React and TypeScript.',
        },
      ],
      sources: [{ name: 'Fake', ok: true, fetched: 3 }],
    });
    expect((result.structuredContent as { attribution: string }).attribution).toContain('Fake');
  });

  it('returns the other places of a role posted once per country', async () => {
    const role = { title: 'Staff Engineer', company: 'Mozilla' };
    const germany = makeJob({ ...role, location: 'Remote Germany', remote_scope: 'Europe' });
    const canada = makeJob({ ...role, location: 'Remote Canada', remote_scope: 'Americas' });
    const c = await connect([new FakeSource([germany, canada])]);

    const result = await c.callTool({ name: 'search_jobs', arguments: {} });

    expect(result.structuredContent).toMatchObject({
      duplicates_removed: 1,
      jobs: [
        {
          id: germany.id,
          other_locations: [
            { job_id: canada.id, location: 'Remote Canada', remote_scope: 'Americas' },
          ],
        },
      ],
    });
  });

  it("shows the copy for the user's country when there is a profile", async () => {
    const role = { title: 'Staff Engineer', company: 'Mozilla' };
    const canada = makeJob({ ...role, location: 'Remote Canada', remote_scope: 'Americas' });
    const bosnia = makeJob({
      ...role,
      location: 'Remote, Bosnia and Herzegovina',
      remote_scope: 'Europe',
      published_at: '2026-09-01T00:00:00.000Z',
    });
    const c = await connect([new FakeSource([canada, bosnia])], staticProfiles(makeProfile()));

    const result = await c.callTool({ name: 'search_jobs', arguments: {} });

    expect(result.structuredContent).toMatchObject({
      jobs: [{ id: bosnia.id, other_locations: [{ job_id: canada.id }] }],
    });
  });

  it('applies limit and sorts newest first', async () => {
    const c = await connect([
      new FakeSource([
        makeJob({ company: 'A', published_at: '2026-10-01T00:00:00.000Z' }),
        makeJob({ company: 'B', published_at: '2026-10-10T00:00:00.000Z' }),
        makeJob({ company: 'C', published_at: '2026-10-05T00:00:00.000Z' }),
      ]),
    ]);

    const result = await c.callTool({ name: 'search_jobs', arguments: { limit: 2 } });
    const content = result.structuredContent as {
      jobs: { company: string }[];
      total_matches: number;
    };

    expect(content.jobs.map((job) => job.company)).toEqual(['B', 'C']);
    expect(content.total_matches).toBe(3);
  });

  it('filters by minimum yearly salary, converting currencies and rates', async () => {
    const c = await connect([
      new FakeSource([
        makeJob({ title: 'Euro', salary: '€70K – €90K' }), // ≈ $101k at most
        makeJob({ title: 'Hourly', salary: '$60-$70 /hour' }), // $145.6k a year at most
        makeJob({ title: 'Unstated', salary: null }),
      ]),
    ]);

    const call = async (args: Record<string, unknown>) => {
      const result = await c.callTool({ name: 'search_jobs', arguments: args });
      return (result.structuredContent as { jobs: { title: string }[] }).jobs.map((j) => j.title);
    };

    expect(await call({ min_salary: 120_000 })).toEqual(['Hourly', 'Unstated']);
    expect(await call({ min_salary: 85_000, salary_currency: 'EUR' })).toEqual([
      'Euro',
      'Hourly',
      'Unstated',
    ]);
    expect(await call({ salary_listed_only: true })).toEqual(['Euro', 'Hourly']);
  });

  it('accepts a single remote_scope or a list', async () => {
    const c = await connect([
      new FakeSource([
        makeJob({ company: 'EU', remote_scope: 'Europe', location: 'Europe' }),
        makeJob({ company: 'US', remote_scope: 'US only', location: 'USA' }),
      ]),
    ]);

    const single = await c.callTool({ name: 'search_jobs', arguments: { remote_scope: 'Europe' } });
    const list = await c.callTool({
      name: 'search_jobs',
      arguments: { remote_scope: ['Europe', 'US only'] },
    });

    expect((single.structuredContent as { total_matches: number }).total_matches).toBe(1);
    expect((list.structuredContent as { total_matches: number }).total_matches).toBe(2);
  });

  it('still returns results when one source fails', async () => {
    const c = await connect([
      new FakeSource([makeJob()]),
      new FakeSource(new Error('HTTP 503'), {
        id: 'arbeitnow',
        name: 'Broken',
        homepage: 'https://broken.test',
      }),
    ]);

    const result = await c.callTool({ name: 'search_jobs', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      total_matches: 1,
      sources: [
        { name: 'Fake', ok: true },
        { name: 'Broken', ok: false, error: 'HTTP 503' },
      ],
    });
  });

  it('reports an error when every source fails', async () => {
    const c = await connect([new FakeSource(new Error('HTTP 429'))]);

    const result = await c.callTool({ name: 'search_jobs', arguments: {} });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('HTTP 429');
  });

  it('rejects invalid input', async () => {
    const c = await connect([new FakeSource([])]);

    const result = await c.callTool({ name: 'search_jobs', arguments: { limit: 0 } });

    expect(result.isError).toBe(true);
  });
});
