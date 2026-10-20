import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  jobIdInput,
  noteInput,
  savedJobSchema,
  toolError,
  toolResult,
  toSavedJobOutput,
  type TrackerStore,
} from './shared.js';

export function registerSaveJob(server: McpServer, store: TrackerStore): void {
  server.registerTool(
    'save_job',
    {
      title: 'Save job',
      description:
        'Saves a job from search_jobs to the local tracker with status "found". Saving it again keeps its current status and appends the note, if any. Does not apply to the job.',
      inputSchema: {
        job_id: jobIdInput,
        notes: noteInput.optional().describe('Optional note, e.g. why it looks interesting.'),
      },
      outputSchema: {
        saved: savedJobSchema,
        created: z.boolean().describe('false if the job was already saved.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ job_id, notes }) => {
      const result = await store.saveJob(job_id, notes);
      if (result.kind === 'job_not_found') {
        return toolError(
          `No job with id "${job_id}". Ids come from search_jobs results; run a search first.`,
        );
      }
      return toolResult({ saved: toSavedJobOutput(result.saved), created: result.created });
    },
  );
}
