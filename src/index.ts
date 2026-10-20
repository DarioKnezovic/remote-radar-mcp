#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { createServer, SERVER_VERSION } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
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
