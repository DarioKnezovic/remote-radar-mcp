import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JobSearchService } from './services/job-search.js';
import { registerSearchJobs } from './tools/search-jobs.js';

export const SERVER_NAME = 'remote-radar';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = `Remote Radar finds remote developer jobs from official public job APIs.
It searches, saves and tracks jobs; it never applies to jobs on the user's behalf.
Always show the job's source and URL so the user can apply on the original listing.`;

export interface ServerDeps {
  search: JobSearchService;
}

/**
 * Builds the MCP server with all tools registered.
 *
 * Kept separate from the stdio entry point so tests can connect to it over an
 * in-memory transport with fake dependencies.
 */
export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerSearchJobs(server, deps.search);

  return server;
}
