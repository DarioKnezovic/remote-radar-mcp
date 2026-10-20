#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { JobRepository } from './db/job-repository.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { PostgresFetchCacheStore } from './db/postgres-fetch-cache-store.js';
import { logger } from './logger.js';
import { FileProfileStore, resolveProfileFile } from './profile/profile-store.js';
import { createServer, SERVER_VERSION } from './server.js';
import { JobSearchService } from './services/job-search.js';
import { createHttpClient } from './sources/http.js';
import { loadBoardsConfig, resolveBoardsFile } from './sources/boards-config.js';
import { createSources } from './sources/registry.js';

const USER_AGENT = `remote-radar-mcp/${SERVER_VERSION} (+https://github.com/DarioKnezovic/remote-radar-mcp)`;

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    await migrate(pool);
  } catch (error) {
    await pool.end();
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot prepare the database (${reason}). Is Postgres running? Try \`docker compose up -d\` in the project folder.`,
      { cause: error },
    );
  }

  const repository = new JobRepository(pool);
  const http = createHttpClient({ userAgent: USER_AGENT });
  const boardsFile = await resolveBoardsFile();
  const boards = await loadBoardsConfig(boardsFile);
  logger.info('loaded company boards', {
    file: boardsFile.pathname,
    greenhouse: boards.greenhouse.length,
    lever: boards.lever.length,
    ashby: boards.ashby.length,
  });
  const sources = createSources(http, new PostgresFetchCacheStore(repository), boards);
  const profiles = new FileProfileStore(resolveProfileFile());
  const server = createServer({
    search: new JobSearchService(sources),
    store: repository,
    profiles,
  });
  const transport = new StdioServerTransport();

  const shutdown = async (signal: string) => {
    logger.info('shutting down', { signal });
    await server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  // The client closing our stdin means it's gone; don't wait for idle DB connections to time out.
  process.stdin.on('end', () => void shutdown('stdin closed'));

  await server.connect(transport);
  logger.info('remote-radar MCP server running on stdio', { version: SERVER_VERSION });
}

main().catch((error: unknown) => {
  logger.error('fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
