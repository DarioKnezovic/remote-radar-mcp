import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { employmentTypeSchema, remoteScopeSchema } from '../domain/job.js';
import { matchJob, RED_FLAG_CODES } from '../domain/match.js';
import type { ProfileStore } from '../profile/profile-store.js';
import { jobIdInput, toolError, toolResult, type TrackerStore } from './shared.js';

export const matchJobOutput = {
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    url: z.string(),
    location: z.string().nullable(),
    remote_scope: remoteScopeSchema,
    employment_type: employmentTypeSchema,
  }),
  matched_skills: z.array(
    z.object({ skill: z.string(), level: z.enum(['strong', 'some', 'learning']) }),
  ),
  missing_skills: z.array(z.string()),
  skill_coverage: z
    .number()
    .nullable()
    .describe('matched / (matched + missing); null if the listing names no known skills.'),
  red_flags: z.array(
    z.object({
      code: z.enum(RED_FLAG_CODES),
      message: z.string(),
      evidence: z.string().optional(),
    }),
  ),
  notes: z.array(z.string()),
};

export function registerMatchJob(
  server: McpServer,
  store: Pick<TrackerStore, 'getJob'>,
  profiles: ProfileStore,
): void {
  server.registerTool(
    'match_job',
    {
      title: 'Match job to profile',
      description:
        "Compares a job with the user's profile.json: matched skills (with the user's level), skills the job wants that the user lacks, and red flags (on-site/hybrid, region or residence limits, work authorization, required languages, part-time, unpaid, US hours, years of experience), each with the text it's based on. Heuristic: read the evidence before concluding.",
      inputSchema: { job_id: jobIdInput },
      outputSchema: matchJobOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ job_id }) => {
      const [job, profileResult] = await Promise.all([store.getJob(job_id), profiles.load()]);
      if (!job) {
        return toolError(
          `No job with id "${job_id}". Ids come from search_jobs results; run a search first.`,
        );
      }
      if (!profileResult.ok) return toolError(profileResult.error);

      return toolResult({
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          url: job.url,
          location: job.location,
          remote_scope: job.remote_scope,
          employment_type: job.employment_type,
        },
        ...matchJob(job, profileResult.profile),
      });
    },
  );
}
