#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { createServer, SERVER_VERSION } from './server.js';
import { JobSearchService } from './services/job-search.js';
import { createHttpClient } from './sources/http.js';
import { createSources } from './sources/registry.js';

const USER_AGENT = `remote-radar-mcp/${SERVER_VERSION} (+https://github.com/DarioKnezovic/remote-radar-mcp)`;

async function main(): Promise<void> {
  const http = createHttpClient({ userAgent: USER_AGENT });
  const search = new JobSearchService(createSources(http));
  const server = createServer({ search });
  const transport = new StdioServerTransport();

  const shutdown = async (signal: string) => {
    logger.info('shutting down', { signal });
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await server.connect(transport);
  logger.info('remote-radar MCP server running on stdio', { version: SERVER_VERSION });
}

main().catch((error: unknown) => {
  logger.error('fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
