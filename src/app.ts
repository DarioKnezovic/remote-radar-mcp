import type pg from 'pg';
import { loadConfig } from './config.js';
import { JobRepository } from './db/job-repository.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { PostgresFetchCacheStore } from './db/postgres-fetch-cache-store.js';
import { logger } from './logger.js';
import {
  FileProfileStore,
  resolveProfileFile,
  type WritableProfileStore,
} from './profile/profile-store.js';
import { JobSearchService } from './services/job-search.js';
import { loadBoardsConfig, resolveBoardsFile, type BoardsConfig } from './sources/boards-config.js';
import { createHttpClient, type HttpClient } from './sources/http.js';
import type { SourceInfo } from './sources/job-source.js';
import { createSources } from './sources/registry.js';
import { VERSION } from './version.js';

/**
 * The core, wired once: database, job sources, search, tracker and profile. Both entry
 * points use it: the MCP server (`index.ts`) and the web app (`web/`), so they share
 * one database and see the same saved jobs.
 */
export interface RemoteRadar {
  search: JobSearchService;
  /** Saved jobs and their status history. */
  tracker: JobRepository;
  profiles: WritableProfileStore;
  /** The enabled job sources, for attribution and "how it works" pages. */
  sources: readonly SourceInfo[];
  boards: BoardsConfig;
  /** The boards file in use, e.g. `boards.json` or `boards.default.json`. */
  boardsFile: string;
  /** Ends the database pool, unless it was passed in. */
  close(): Promise<void>;
}

export interface RemoteRadarOptions {
  /** Identifies the app to the job APIs; defaults to the package name and version. */
  userAgent?: string;
  env?: NodeJS.ProcessEnv;
  /** Use this pool instead of creating one from `DATABASE_URL` (tests). Not closed by `close()`. */
  pool?: pg.Pool;
  /** Use this HTTP client instead of the real one (tests). */
  http?: HttpClient;
}

export const DEFAULT_USER_AGENT = `remote-radar-mcp/${VERSION} (+https://github.com/DarioKnezovic/remote-radar-mcp)`;

/** Connects to Postgres, applies migrations and builds every service. */
export async function createRemoteRadar(options: RemoteRadarOptions = {}): Promise<RemoteRadar> {
  const env = options.env ?? process.env;
  const ownsPool = !options.pool;
  const pool = options.pool ?? createPool(loadConfig(env).databaseUrl);

  try {
    await migrate(pool);
  } catch (error) {
    if (ownsPool) await pool.end();
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot prepare the database (${reason}). Is Postgres running? Try \`docker compose up -d\` in the project folder.`,
      { cause: error },
    );
  }

  const tracker = new JobRepository(pool);
  const http =
    options.http ?? createHttpClient({ userAgent: options.userAgent ?? DEFAULT_USER_AGENT });
  const boardsUrl = await resolveBoardsFile(env);
  const boards = await loadBoardsConfig(boardsUrl);
  logger.info('loaded company boards', {
    file: boardsUrl.pathname,
    greenhouse: boards.greenhouse.length,
    lever: boards.lever.length,
    ashby: boards.ashby.length,
  });
  const sources = createSources(http, new PostgresFetchCacheStore(tracker), boards);

  return {
    search: new JobSearchService(sources),
    tracker,
    profiles: new FileProfileStore(resolveProfileFile(env)),
    sources: sources.map((source) => source.info),
    boards,
    boardsFile: boardsUrl.pathname,
    async close() {
      if (ownsPool) await pool.end();
    },
  };
}

// The parts of the core the web app uses, so it imports from one place.
export {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type SavedJob,
} from './domain/application.js';
export {
  EMPLOYMENT_TYPES,
  REMOTE_SCOPES,
  SOURCE_IDS,
  type EmploymentType,
  type Job,
  type RemoteScope,
  type SourceId,
} from './domain/job.js';
export {
  matchJob,
  RED_FLAG_CODES,
  type MatchResult,
  type RedFlag,
  type RedFlagCode,
} from './domain/match.js';
export { profileSchema, type Profile, type SkillLevel } from './domain/profile.js';
export { htmlToText, truncate } from './domain/text.js';
export type { SaveResult, UpdateStatusResult } from './db/job-repository.js';
export type { ProfileIssue, ProfileResult } from './profile/profile-store.js';
export type { SearchParams, SearchResult, SourceStatus } from './services/job-search.js';
export type { SourceInfo } from './sources/job-source.js';
export { VERSION } from './version.js';
