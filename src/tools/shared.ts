import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { applicationStatusSchema, type SavedJob } from '../domain/application.js';
import {
  employmentTypeSchema,
  remoteScopeSchema,
  sourceIdSchema,
  type Job,
  type SourceId,
} from '../domain/job.js';
import type { JobRepository } from '../db/job-repository.js';

/** The subset of the repository the tracker tools need (keeps tools easy to test). */
export type TrackerStore = Pick<
  JobRepository,
  'getJob' | 'getSavedJob' | 'saveJob' | 'updateStatus' | 'listSavedJobs' | 'getCoverLetter'
>;

/** Job boards whose terms ask for credit by name, with a link back. */
const BOARD_ATTRIBUTION: Partial<Record<SourceId, string>> = {
  remotive: 'Remotive (https://remotive.com)',
  arbeitnow: 'Arbeitnow (https://www.arbeitnow.com)',
  remoteok: 'Remote OK (https://remoteok.com)',
};

const ATS_NAMES: Partial<Record<SourceId, string>> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
};

/** Credit line for one job: the job board, or the company's own careers page on its ATS. */
export function attributionFor(job: Pick<Job, 'source' | 'company'>): string {
  return (
    BOARD_ATTRIBUTION[job.source] ??
    `${job.company}'s careers page (hosted on ${ATS_NAMES[job.source] ?? job.source})`
  );
}

export const jobIdInput = z
  .string()
  .trim()
  .regex(/^[a-z]+:.+$/, 'expected "<source>:<id>", e.g. "remotive:2091158"')
  .max(300)
  .describe('Job id from search_jobs, e.g. "remotive:2091158".');

export const noteInput = z.string().trim().min(1).max(2000);

export const savedJobSchema = z.object({
  job_id: z.string(),
  title: z.string(),
  company: z.string(),
  source: sourceIdSchema,
  url: z.string(),
  remote_scope: remoteScopeSchema,
  employment_type: employmentTypeSchema,
  salary: z.string().nullable(),
  status: applicationStatusSchema,
  notes: z.string().nullable(),
  saved_at: z.string(),
  updated_at: z.string(),
});

export function toSavedJobOutput(saved: SavedJob): z.infer<typeof savedJobSchema> {
  return {
    job_id: saved.job.id,
    title: saved.job.title,
    company: saved.job.company,
    source: saved.job.source,
    url: saved.job.url,
    remote_scope: saved.job.remote_scope,
    employment_type: saved.job.employment_type,
    salary: saved.job.salary,
    status: saved.status,
    notes: saved.notes,
    saved_at: saved.saved_at,
    updated_at: saved.updated_at,
  };
}

/** Successful result with structured content plus a JSON text copy for clients without structured output. */
export function toolResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

/** An error the model should see and can act on (e.g. "run search_jobs first"). */
export function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
