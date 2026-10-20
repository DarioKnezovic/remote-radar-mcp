import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProfileStore } from './profile/profile-store.js';
import type { JobSearchService } from './services/job-search.js';
import { registerGetJobDetails } from './tools/get-job-details.js';
import { registerGetProfile } from './tools/get-profile.js';
import { registerListSavedJobs } from './tools/list-saved-jobs.js';
import { registerMatchJob } from './tools/match-job.js';
import { registerSaveJob } from './tools/save-job.js';
import { registerSearchJobs } from './tools/search-jobs.js';
import type { TrackerStore } from './tools/shared.js';
import { registerUpdateJobStatus } from './tools/update-job-status.js';
import { VERSION } from './version.js';

export const SERVER_NAME = 'remote-radar';
export const SERVER_VERSION = VERSION;

const INSTRUCTIONS = `Remote Radar finds remote developer jobs from official public job APIs.
It searches, saves and tracks jobs, and compares them with the user's profile; it never applies
to jobs on the user's behalf. Drafts (e.g. a cover letter) are for the user to review and send.
Always show the job's source and URL so the user can apply on the original listing.`;

export interface ServerDeps {
  search: JobSearchService;
  store: TrackerStore;
  profiles: ProfileStore;
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
  registerGetJobDetails(server, deps.store);
  registerSaveJob(server, deps.store);
  registerUpdateJobStatus(server, deps.store);
  registerListSavedJobs(server, deps.store);
  registerGetProfile(server, deps.profiles);
  registerMatchJob(server, deps.store, deps.profiles);

  return server;
}
