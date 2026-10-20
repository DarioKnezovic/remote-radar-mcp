import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { applicationStatusSchema } from '../domain/application.js';
import { employmentTypeSchema, remoteScopeSchema, sourceIdSchema } from '../domain/job.js';
import { htmlToText, truncate } from '../domain/text.js';
import {
  jobIdInput,
  SOURCE_ATTRIBUTION,
  toolError,
  toolResult,
  type TrackerStore,
} from './shared.js';

/** Keeps one very long listing from flooding the model's context. */
const MAX_DESCRIPTION_LENGTH = 12_000;

export const getJobDetailsOutput = {
  job: z.object({
    id: z.string(),
    source: sourceIdSchema,
    source_job_id: z.string(),
    url: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().nullable(),
    remote_scope: remoteScopeSchema,
    employment_type: employmentTypeSchema,
    salary: z.string().nullable(),
    tags: z.array(z.string()),
    description: z.string().describe('Plain text converted from the listing HTML.'),
    published_at: z.string(),
  }),
  saved: z
    .object({
      status: applicationStatusSchema,
      notes: z.string().nullable(),
      saved_at: z.string(),
      updated_at: z.string(),
    })
    .nullable()
    .describe('Tracker entry if the job is saved, otherwise null.'),
  attribution: z.string(),
};

export function registerGetJobDetails(server: McpServer, store: TrackerStore): void {
  server.registerTool(
    'get_job_details',
    {
      title: 'Get job details',
      description:
        'Returns the full normalized job (including the description as plain text) for an id from search_jobs, plus its tracker status if saved.',
      inputSchema: { job_id: jobIdInput },
      outputSchema: getJobDetailsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ job_id }) => {
      const [job, saved] = await Promise.all([store.getJob(job_id), store.getSavedJob(job_id)]);
      if (!job) {
        return toolError(
          `No job with id "${job_id}". Ids come from search_jobs results; run a search first.`,
        );
      }
      return toolResult({
        job: { ...job, description: truncate(htmlToText(job.description), MAX_DESCRIPTION_LENGTH) },
        saved: saved
          ? {
              status: saved.status,
              notes: saved.notes,
              saved_at: saved.saved_at,
              updated_at: saved.updated_at,
            }
          : null,
        attribution: `Listing via ${SOURCE_ATTRIBUTION[job.source]}. Apply at ${job.url}`,
      });
    },
  );
}
