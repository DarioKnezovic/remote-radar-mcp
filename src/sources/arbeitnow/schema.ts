import { z } from 'zod';

/**
 * Raw Arbeitnow API shapes, verified against https://www.arbeitnow.com/blog/job-board-api
 * and live responses (2026-10). The docs only describe the `remote` field; the rest
 * is taken from real responses.
 */
export const arbeitnowJobSchema = z.object({
  slug: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().nullish(),
  /** Unreliable on its own: some remote listings say `false` with "Remote" in the title/location. */
  remote: z.boolean().nullish(),
  url: z.url(),
  tags: z.array(z.string()).nullish(),
  /** Free text in several languages, mixing contract type and seniority, e.g. "Full Time", "Werkstudent", "Mid". */
  job_types: z.array(z.string()).nullish(),
  location: z.string().nullish(),
  /** Unix seconds. */
  created_at: z.number().int().positive(),
});
export type ArbeitnowJob = z.infer<typeof arbeitnowJobSchema>;

/** Jobs are validated one by one, so one malformed listing doesn't drop the whole page. */
export const arbeitnowResponseSchema = z.object({
  data: z.array(z.unknown()),
  links: z.object({ next: z.string().nullish() }).nullish(),
});
