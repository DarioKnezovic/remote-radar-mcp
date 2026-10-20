#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRemoteRadar } from './app.js';
import { logger } from './logger.js';
import { createServer, SERVER_VERSION } from './server.js';

async function main(): Promise<void> {
  const app = await createRemoteRadar();
  const server = createServer({ search: app.search, store: app.tracker, profiles: app.profiles });
  const transport = new StdioServerTransport();

  const shutdown = async (signal: string) => {
    logger.info('shutting down', { signal });
    await server.close();
    await app.close();
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
