import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { applicationStatusSchema } from '../domain/application.js';
import { savedJobSchema, toolResult, toSavedJobOutput, type TrackerStore } from './shared.js';

export function registerListSavedJobs(server: McpServer, store: TrackerStore): void {
  server.registerTool(
    'list_saved_jobs',
    {
      title: 'List saved jobs',
      description:
        'Lists jobs in the local tracker with their status and notes, most recently updated first.',
      inputSchema: {
        status: applicationStatusSchema.optional().describe('Only jobs with this status.'),
      },
      outputSchema: { jobs: z.array(savedJobSchema), count: z.number().int() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ status }) => {
      const saved = await store.listSavedJobs(status);
      return toolResult({ jobs: saved.map(toSavedJobOutput), count: saved.length });
    },
  );
}
