import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobRepository } from '../../src/db/job-repository.js';
import { migrate } from '../../src/db/migrate.js';
import { makeJob } from '../helpers.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from './db.js';

describe.skipIf(!TEST_DATABASE_URL)('JobRepository (Postgres)', () => {
  let db: TestDatabase;
  let repo: JobRepository;
  let clock: Date;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    await db.reset();
    clock = new Date('2026-10-20T10:00:00.000Z');
    repo = new JobRepository(db.pool, () => clock);
  });

  const seenAt = new Date('2026-10-20T09:00:00.000Z');

  describe('migrations', () => {
    it('are idempotent', async () => {
      expect(await migrate(db.pool)).toEqual([]);
      const { rows } = await db.pool.query<{ name: string }>(
        'SELECT name FROM schema_migrations ORDER BY name',
      );
      expect(rows.map((row) => row.name)).toEqual(['001_init.sql', '002_cover_letters.sql']);
    });
  });

  describe('jobs', () => {
    it('round-trips a job', async () => {
      const job = makeJob({ salary: '$100k', tags: ['react', 'node.js'], location: null });
      await repo.upsertJobs([job], seenAt);
      expect(await repo.getJob(job.id)).toEqual(job);
    });

    it('returns undefined for unknown ids', async () => {
      expect(await repo.getJob('remotive:nope')).toBeUndefined();
    });

    it('updates an existing job and its last_seen_at', async () => {
      const job = makeJob({ title: 'Old title' });
      await repo.upsertJobs([job], seenAt);
      const later = new Date('2026-10-20T12:00:00.000Z');
      await repo.upsertJobs([{ ...job, title: 'New title' }], later);

      expect((await repo.getJob(job.id))?.title).toBe('New title');
      expect(await repo.listJobsSeenSince(job.source, later)).toHaveLength(1);
    });

    it('collapses duplicate ids within one batch', async () => {
      const job = makeJob();
      await repo.upsertJobs([job, { ...job, title: 'Second copy' }], seenAt);
      expect((await repo.getJob(job.id))?.title).toBe('Second copy');
    });

    it('lists only jobs seen in or after a fetch', async () => {
      const gone = makeJob();
      const current = makeJob();
      await repo.upsertJobs([gone, current], seenAt);
      const nextFetch = new Date('2026-10-20T12:00:00.000Z');
      await repo.upsertJobs([current], nextFetch);

      const jobs = await repo.listJobsSeenSince('remotive', nextFetch);
      expect(jobs.map((job) => job.id)).toEqual([current.id]);
    });
  });

  describe('source fetches', () => {
    it('stores jobs and the fetch record together', async () => {
      const jobs = [makeJob(), makeJob()];
      await repo.recordSuccessfulFetch('remotive', jobs, seenAt);

      expect(await repo.latestFetch('remotive', true)).toEqual({
        at: seenAt,
        ok: true,
        jobCount: 2,
      });
      expect(await repo.latestFetch('arbeitnow', true)).toBeUndefined();
    });

    it('records failures separately', async () => {
      await repo.recordFailedFetch('arbeitnow', 'HTTP 429', seenAt);
      expect(await repo.latestFetch('arbeitnow', false)).toEqual({
        at: seenAt,
        ok: false,
        error: 'HTTP 429',
      });
    });
  });

  describe('saved jobs', () => {
    it('refuses to save a job that was never fetched', async () => {
      expect(await repo.saveJob('remotive:unknown')).toEqual({ kind: 'job_not_found' });
    });

    it('saves with status "found", a dated note and a history entry', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);

      const result = await repo.saveJob(job.id, 'Referral from a former colleague');

      expect(result).toMatchObject({
        kind: 'saved',
        created: true,
        saved: {
          job,
          status: 'found',
          notes: '[2026-10-20 found] Referral from a former colleague',
          saved_at: clock.toISOString(),
          updated_at: clock.toISOString(),
        },
      });
      expect(await repo.getStatusHistory(job.id)).toEqual([
        {
          from_status: null,
          to_status: 'found',
          notes: 'Referral from a former colleague',
          changed_at: clock,
        },
      ]);
    });

    it('saving again keeps the status and appends the note', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      await repo.saveJob(job.id, 'first');
      await repo.updateStatus(job.id, 'applied');

      clock = new Date('2026-10-22T10:00:00.000Z');
      const again = await repo.saveJob(job.id, 'second');

      expect(again).toMatchObject({
        kind: 'saved',
        created: false,
        saved: {
          status: 'applied',
          notes: '[2026-10-20 found] first\n[2026-10-22 applied] second',
        },
      });
    });

    it('saving again without a note changes nothing', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      const first = await repo.saveJob(job.id);
      clock = new Date('2026-10-22T10:00:00.000Z');
      const again = await repo.saveJob(job.id);

      expect(again.kind === 'saved' && again.saved).toEqual(first.kind === 'saved' && first.saved);
    });

    it('updates status, appends notes and records history', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      await repo.saveJob(job.id);

      clock = new Date('2026-10-21T10:00:00.000Z');
      const applied = await repo.updateStatus(job.id, 'applied', 'Sent CV via careers page');
      clock = new Date('2026-10-28T10:00:00.000Z');
      const interview = await repo.updateStatus(job.id, 'interview');

      expect(applied).toMatchObject({ kind: 'updated', previousStatus: 'found' });
      expect(interview).toMatchObject({
        kind: 'updated',
        previousStatus: 'applied',
        saved: {
          status: 'interview',
          notes: '[2026-10-21 applied] Sent CV via careers page',
          updated_at: '2026-10-28T10:00:00.000Z',
        },
      });
      const history = await repo.getStatusHistory(job.id);
      expect(history.map((h) => [h.from_status, h.to_status])).toEqual([
        [null, 'found'],
        ['found', 'applied'],
        ['applied', 'interview'],
      ]);
    });

    it('refuses to update a job that is not saved', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      expect(await repo.updateStatus(job.id, 'applied')).toEqual({ kind: 'not_saved' });
    });

    it('lists saved jobs, most recently updated first, optionally by status', async () => {
      const [a, b, c] = [makeJob(), makeJob(), makeJob()];
      await repo.upsertJobs([a, b, c], seenAt);
      await repo.saveJob(a.id);
      clock = new Date('2026-10-21T10:00:00.000Z');
      await repo.saveJob(b.id);
      clock = new Date('2026-10-22T10:00:00.000Z');
      await repo.saveJob(c.id);
      clock = new Date('2026-10-23T10:00:00.000Z');
      await repo.updateStatus(a.id, 'applied');

      const all = await repo.listSavedJobs();
      expect(all.map((s) => s.job.id)).toEqual([a.id, c.id, b.id]);
      const found = await repo.listSavedJobs('found');
      expect(found.map((s) => s.job.id)).toEqual([c.id, b.id]);
    });

    it('enforces valid statuses in the database itself', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      await expect(
        db.pool.query("INSERT INTO saved_jobs (job_id, status) VALUES ($1, 'hired')", [job.id]),
      ).rejects.toThrow(/check constraint/);
    });
  });
  describe('cover letters', () => {
    it('refuses a draft for a job that was never fetched', async () => {
      expect(await repo.saveCoverLetter('remotive:nope', 'Dear team')).toEqual({
        kind: 'job_not_found',
      });
    });

    it('saves, replaces and deletes a draft', async () => {
      const job = makeJob();
      await repo.upsertJobs([job], seenAt);
      expect(await repo.getCoverLetter(job.id)).toBeUndefined();

      await repo.saveCoverLetter(job.id, 'First draft');
      clock = new Date('2026-10-21T08:00:00.000Z');
      expect(await repo.saveCoverLetter(job.id, 'Second draft')).toEqual({
        kind: 'saved',
        coverLetter: { body: 'Second draft', updated_at: '2026-10-21T08:00:00.000Z' },
      });
      expect(await repo.getCoverLetter(job.id)).toEqual({
        body: 'Second draft',
        updated_at: '2026-10-21T08:00:00.000Z',
      });

      expect(await repo.saveCoverLetter(job.id, '   ')).toEqual({ kind: 'deleted' });
      expect(await repo.getCoverLetter(job.id)).toBeUndefined();
    });
  });
});
