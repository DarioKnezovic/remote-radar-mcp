import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applicationStatusSchema } from '../domain/application.js';
import {
  jobIdInput,
  noteInput,
  savedJobSchema,
  toolError,
  toolResult,
  toSavedJobOutput,
  type TrackerStore,
} from './shared.js';

export function registerUpdateJobStatus(server: McpServer, store: TrackerStore): void {
  server.registerTool(
    'update_job_status',
    {
      title: 'Update job status',
      description:
        'Records where a saved job is in the application process (found → applied → interview → offer, or rejected / skipped). Only records what the user reports; it never submits anything.',
      inputSchema: {
        job_id: jobIdInput,
        status: applicationStatusSchema,
        notes: noteInput
          .optional()
          .describe('Optional note appended to the log, e.g. "Applied via their careers page".'),
      },
      outputSchema: { saved: savedJobSchema, previous_status: applicationStatusSchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ job_id, status, notes }) => {
      const result = await store.updateStatus(job_id, status, notes);
      if (result.kind === 'not_saved') {
        return toolError(`Job "${job_id}" is not saved. Save it with save_job first.`);
      }
      return toolResult({
        saved: toSavedJobOutput(result.saved),
        previous_status: result.previousStatus,
      });
    },
  );
}
