import { z } from 'zod';

/**
 * Raw Remotive API shapes, verified against https://github.com/remotive-io/remote-jobs-api
 * and live responses (2026-10). Lenient on purpose: optional fields are often empty,
 * and `tags` is returned although the docs don't list it.
 */
export const remotiveJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.url(),
  title: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  category: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  /** full_time | part_time | contract | freelance | internship | other — often empty. */
  job_type: z.string().nullish(),
  /** e.g. "2026-10-17T16:04:29" — no timezone; treated as UTC. */
  publication_date: z.string(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string().nullish(),
});
export type RemotiveJob = z.infer<typeof remotiveJobSchema>;

/** Jobs are validated one by one, so one malformed listing doesn't drop the whole feed. */
export const remotiveResponseSchema = z.object({
  jobs: z.array(z.unknown()),
});
