import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  employmentTypeSchema,
  remoteScopeSchema,
  sourceIdSchema,
  type Job,
  type RemoteScope,
} from '../domain/job.js';
import { htmlToText, truncate } from '../domain/text.js';
import type { JobSearchService } from '../services/job-search.js';

const SNIPPET_LENGTH = 240;
const MAX_TAGS_IN_SUMMARY = 8;

export const searchJobsInput = {
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe(
      'Words that must all appear (whole-word, case-insensitive) in title, company, tags, location or description, e.g. "react typescript".',
    ),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20)
    .optional()
    .describe('Job must have at least one of these tags, e.g. ["react", "node.js"].'),
  remote_scope: z
    .union([remoteScopeSchema, z.array(remoteScopeSchema).min(1)])
    .optional()
    .describe(
      'Where the job can be done from; one scope or a list (any of). Multi-region jobs match a scope if their location includes it. Default: all remote jobs, on-site excluded.',
    ),
  posted_within_days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Only jobs published in the last N days.'),
  limit: z.number().int().min(1).max(50).default(20).describe('Max jobs to return (default 20).'),
};

const jobSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  source: sourceIdSchema,
  url: z.string(),
  remote_scope: remoteScopeSchema,
  location: z.string().nullable(),
  employment_type: employmentTypeSchema,
  salary: z.string().nullable(),
  tags: z.array(z.string()),
  published_at: z.string(),
  snippet: z.string(),
});

export const searchJobsOutput = {
  jobs: z.array(jobSummarySchema),
  total_matches: z.number().int(),
  duplicates_removed: z.number().int(),
  sources: z.array(
    z.object({
      id: sourceIdSchema,
      name: z.string(),
      homepage: z.string(),
      ok: z.boolean(),
      fetched: z.number().int(),
      error: z.string().optional(),
    }),
  ),
  attribution: z.string(),
};

export function toJobSummary(job: Job): z.infer<typeof jobSummarySchema> {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    source: job.source,
    url: job.url,
    remote_scope: job.remote_scope,
    location: job.location,
    employment_type: job.employment_type,
    salary: job.salary,
    tags: job.tags.slice(0, MAX_TAGS_IN_SUMMARY),
    published_at: job.published_at,
    snippet: truncate(htmlToText(job.description).replace(/\s+/g, ' '), SNIPPET_LENGTH),
  };
}

function toScopeList(scope: RemoteScope | RemoteScope[] | undefined): RemoteScope[] | undefined {
  if (scope === undefined) return undefined;
  return Array.isArray(scope) ? scope : [scope];
}

export function registerSearchJobs(server: McpServer, search: JobSearchService): void {
  server.registerTool(
    'search_jobs',
    {
      title: 'Search remote jobs',
      description:
        "Searches remote job listings from official public job APIs, removes duplicates (same company + similar title) and returns a short list, newest first. Results are read-only: this never applies to jobs. Always show each job's source and url.",
      inputSchema: searchJobsInput,
      outputSchema: searchJobsOutput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      const result = await search.search({
        query: args.query,
        tags: args.tags,
        remoteScopes: toScopeList(args.remote_scope),
        postedWithinDays: args.posted_within_days,
        limit: args.limit,
      });

      const okSources = result.sources.filter((source) => source.ok);
      if (okSources.length === 0) {
        const reasons = result.sources.map((s) => `${s.name}: ${s.error ?? 'unknown error'}`);
        return {
          isError: true,
          content: [{ type: 'text', text: `All job sources failed. ${reasons.join('; ')}` }],
        };
      }

      const structuredContent = {
        jobs: result.jobs.map(toJobSummary),
        total_matches: result.totalMatches,
        duplicates_removed: result.duplicatesRemoved,
        sources: result.sources,
        attribution: `Listings via ${okSources.map((s) => `${s.name} (${s.homepage})`).join(', ')}. Apply on the original listing URL.`,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );
}
