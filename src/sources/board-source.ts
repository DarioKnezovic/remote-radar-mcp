import type { Job } from '../domain/job.js';
import { logger } from '../logger.js';
import type { JobSource, SourceInfo } from './job-source.js';

/** One company's public job board on an applicant tracking system (Greenhouse, Lever, Ashby, …). */
export interface Board {
  /** The board token / site name in the URL, e.g. "gitlab". */
  board: string;
  /** Company name shown on every job (the APIs don't always return one). */
  company: string;
}

/** Boards fetched at the same time per source; keeps us polite to each ATS. */
const DEFAULT_CONCURRENCY = 4;

/**
 * A {@link JobSource} made of many company boards on the same ATS. Boards are fetched
 * a few at a time; a failing board (renamed, moved to another ATS, temporarily down)
 * is logged and skipped. The source only fails if every board fails.
 */
export class BoardsJobSource<B extends Board> implements JobSource {
  constructor(
    readonly info: SourceInfo,
    private readonly boards: readonly B[],
    private readonly fetchBoard: (board: B) => Promise<Job[]>,
    private readonly concurrency = DEFAULT_CONCURRENCY,
  ) {}

  async fetchJobs(): Promise<Job[]> {
    const results = await mapWithConcurrency(this.boards, this.concurrency, this.fetchBoard);
    const jobs: Job[] = [];
    const failures: string[] = [];

    results.forEach(({ item: { board }, ...result }) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value);
      } else {
        const reason: unknown = result.reason;
        failures.push(`${board}: ${reason instanceof Error ? reason.message : String(reason)}`);
      }
    });

    if (failures.length > 0 && failures.length === this.boards.length) {
      throw new Error(`${this.info.name}: every board failed (${failures.join('; ')})`);
    }
    if (failures.length > 0) {
      logger.warn('some boards failed', { source: this.info.id, failures });
    }
    return jobs;
  }
}

export type SettledWithItem<T, R> = { item: T } & PromiseSettledResult<R>;

/**
 * Like Promise.allSettled over `items.map(fn)`, but with at most `limit` calls in flight.
 * Results keep the input order and carry their item.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<SettledWithItem<T, R>[]> {
  const results = new Array<SettledWithItem<T, R>>(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { item, index } = next;
      try {
        results[index] = { item, status: 'fulfilled', value: await fn(item) };
      } catch (reason) {
        results[index] = { item, status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
