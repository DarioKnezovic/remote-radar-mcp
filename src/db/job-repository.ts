import type { Pool, PoolClient } from 'pg';
import { formatNoteEntry, type ApplicationStatus, type SavedJob } from '../domain/application.js';
import type { EmploymentType, Job, RemoteScope, SourceId } from '../domain/job.js';

interface JobRow {
  id: string;
  source: SourceId;
  source_job_id: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  remote_scope: RemoteScope;
  employment_type: EmploymentType;
  salary: string | null;
  tags: string[];
  description: string;
  published_at: Date;
}

interface SavedJobRow extends JobRow {
  status: ApplicationStatus;
  notes: string | null;
  saved_at: Date;
  updated_at: Date;
}

const JOB_COLUMNS = `j.id, j.source, j.source_job_id, j.url, j.title, j.company, j.location,
  j.remote_scope, j.employment_type, j.salary, j.tags, j.description, j.published_at`;

const SAVED_COLUMNS = `${JOB_COLUMNS}, s.status, s.notes, s.saved_at, s.updated_at`;

/** Asserts a row that the surrounding transaction guarantees exists. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Expected ${what} to exist`);
  return value;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    source: row.source,
    source_job_id: row.source_job_id,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location,
    remote_scope: row.remote_scope,
    employment_type: row.employment_type,
    salary: row.salary,
    tags: row.tags,
    description: row.description,
    published_at: row.published_at.toISOString(),
  };
}

function toSavedJob(row: SavedJobRow): SavedJob {
  return {
    job: toJob(row),
    status: row.status,
    notes: row.notes,
    saved_at: row.saved_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export interface FetchRecord {
  at: Date;
  ok: boolean;
  jobCount?: number;
  error?: string;
}

export type SaveResult =
  { kind: 'saved'; saved: SavedJob; created: boolean } | { kind: 'job_not_found' };

export type UpdateStatusResult =
  { kind: 'updated'; saved: SavedJob; previousStatus: ApplicationStatus } | { kind: 'not_saved' };

/** All SQL lives here. Methods take plain values and return domain objects. */
export class JobRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Jobs (fetched listings) ────────────────────────────────────────────────

  /** Inserts or refreshes jobs and marks them as seen at `seenAt`. */
  async upsertJobs(jobs: readonly Job[], seenAt: Date, db: Pool | PoolClient = this.pool) {
    if (jobs.length === 0) return;
    // A page boundary can shift between requests and return the same job twice;
    // ON CONFLICT can't touch one row twice in a statement, so collapse by id first.
    const unique = [...new Map(jobs.map((job) => [job.id, job])).values()];
    await db.query(
      `INSERT INTO jobs (id, source, source_job_id, url, title, company, location, remote_scope,
         employment_type, salary, tags, description, published_at, first_seen_at, last_seen_at)
       SELECT x.id, x.source, x.source_job_id, x.url, x.title, x.company, x.location,
         x.remote_scope, x.employment_type, x.salary,
         ARRAY(SELECT jsonb_array_elements_text(x.tags)), x.description, x.published_at, $2, $2
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, source text, source_job_id text, url text, title text, company text,
         location text, remote_scope text, employment_type text, salary text, tags jsonb,
         description text, published_at timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         url = EXCLUDED.url, title = EXCLUDED.title, company = EXCLUDED.company,
         location = EXCLUDED.location, remote_scope = EXCLUDED.remote_scope,
         employment_type = EXCLUDED.employment_type, salary = EXCLUDED.salary,
         tags = EXCLUDED.tags, description = EXCLUDED.description,
         published_at = EXCLUDED.published_at, last_seen_at = EXCLUDED.last_seen_at`,
      [JSON.stringify(unique), seenAt],
    );
  }

  async getJob(id: string): Promise<Job | undefined> {
    const { rows } = await this.pool.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM jobs j WHERE j.id = $1`,
      [id],
    );
    return rows[0] && toJob(rows[0]);
  }

  async listJobsSeenSince(source: SourceId, since: Date): Promise<Job[]> {
    const { rows } = await this.pool.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM jobs j WHERE j.source = $1 AND j.last_seen_at >= $2
       ORDER BY j.published_at DESC`,
      [source, since],
    );
    return rows.map(toJob);
  }

  // ── Source fetches (rate-limit bookkeeping) ────────────────────────────────

  /** Stores a successful fetch: jobs and the fetch record commit together. */
  async recordSuccessfulFetch(source: SourceId, jobs: readonly Job[], at: Date): Promise<void> {
    await this.transaction(async (client) => {
      await this.upsertJobs(jobs, at, client);
      await client.query(
        'INSERT INTO source_fetches (source, fetched_at, ok, job_count) VALUES ($1, $2, true, $3)',
        [source, at, jobs.length],
      );
    });
  }

  async recordFailedFetch(source: SourceId, error: string, at: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO source_fetches (source, fetched_at, ok, error) VALUES ($1, $2, false, $3)',
      [source, at, error],
    );
  }

  async latestFetch(source: SourceId, ok: boolean): Promise<FetchRecord | undefined> {
    const { rows } = await this.pool.query<{
      fetched_at: Date;
      job_count: number | null;
      error: string | null;
    }>(
      `SELECT fetched_at, job_count, error FROM source_fetches
       WHERE source = $1 AND ok = $2 ORDER BY fetched_at DESC LIMIT 1`,
      [source, ok],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      at: row.fetched_at,
      ok,
      ...(row.job_count !== null && { jobCount: row.job_count }),
      ...(row.error !== null && { error: row.error }),
    };
  }

  // ── Saved jobs (application tracker) ──────────────────────────────────────

  async getSavedJob(jobId: string, db: Pool | PoolClient = this.pool) {
    const { rows } = await db.query<SavedJobRow>(
      `SELECT ${SAVED_COLUMNS} FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
       WHERE s.job_id = $1`,
      [jobId],
    );
    return rows[0] && toSavedJob(rows[0]);
  }

  async listSavedJobs(status?: ApplicationStatus): Promise<SavedJob[]> {
    const { rows } = await this.pool.query<SavedJobRow>(
      `SELECT ${SAVED_COLUMNS} FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
       WHERE $1::text IS NULL OR s.status = $1
       ORDER BY s.updated_at DESC, s.job_id`,
      [status ?? null],
    );
    return rows.map(toSavedJob);
  }

  /**
   * Saves a job with status "found". Saving an already-saved job keeps its status;
   * a note, if given, is appended to its log.
   */
  async saveJob(jobId: string, note?: string): Promise<SaveResult> {
    return this.transaction(async (client) => {
      const exists = await client.query('SELECT 1 FROM jobs WHERE id = $1', [jobId]);
      if (exists.rowCount === 0) return { kind: 'job_not_found' } as const;

      const now = this.now();
      const inserted = await client.query(
        `INSERT INTO saved_jobs (job_id, status, notes, saved_at, updated_at)
         VALUES ($1, 'found', $2, $3, $3) ON CONFLICT (job_id) DO NOTHING`,
        [jobId, note ? formatNoteEntry('found', note, now) : null, now],
      );
      const created = inserted.rowCount === 1;

      if (created) {
        await this.addHistory(client, jobId, null, 'found', note, now);
      } else if (note) {
        const { rows } = await client.query<{ status: ApplicationStatus }>(
          'SELECT status FROM saved_jobs WHERE job_id = $1 FOR UPDATE',
          [jobId],
        );
        const { status } = must(rows[0], `saved job ${jobId}`);
        await this.appendNote(client, jobId, formatNoteEntry(status, note, now), now);
      }

      const saved = must(await this.getSavedJob(jobId, client), `saved job ${jobId}`);
      return { kind: 'saved', saved, created } as const;
    });
  }

  /** Changes a saved job's status, logging the change (and note) in job_status_history. */
  async updateStatus(
    jobId: string,
    status: ApplicationStatus,
    note?: string,
  ): Promise<UpdateStatusResult> {
    return this.transaction(async (client) => {
      const { rows } = await client.query<{ status: ApplicationStatus }>(
        'SELECT status FROM saved_jobs WHERE job_id = $1 FOR UPDATE',
        [jobId],
      );
      const previous = rows[0];
      if (!previous) return { kind: 'not_saved' } as const;

      const now = this.now();
      await client.query('UPDATE saved_jobs SET status = $2, updated_at = $3 WHERE job_id = $1', [
        jobId,
        status,
        now,
      ]);
      if (note) await this.appendNote(client, jobId, formatNoteEntry(status, note, now), now);
      await this.addHistory(client, jobId, previous.status, status, note, now);

      const saved = must(await this.getSavedJob(jobId, client), `saved job ${jobId}`);
      return { kind: 'updated', saved, previousStatus: previous.status } as const;
    });
  }

  async getStatusHistory(jobId: string) {
    const { rows } = await this.pool.query<{
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      notes: string | null;
      changed_at: Date;
    }>(
      `SELECT from_status, to_status, notes, changed_at FROM job_status_history
       WHERE job_id = $1 ORDER BY changed_at, id`,
      [jobId],
    );
    return rows;
  }

  private async appendNote(client: PoolClient, jobId: string, entry: string, now: Date) {
    await client.query(
      `UPDATE saved_jobs SET notes = concat_ws(E'\\n', notes, $2::text), updated_at = $3
       WHERE job_id = $1`,
      [jobId, entry, now],
    );
  }

  private async addHistory(
    client: PoolClient,
    jobId: string,
    from: ApplicationStatus | null,
    to: ApplicationStatus,
    note: string | undefined,
    at: Date,
  ) {
    await client.query(
      `INSERT INTO job_status_history (job_id, from_status, to_status, notes, changed_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, from, to, note?.trim() ?? null, at],
    );
  }

  private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
