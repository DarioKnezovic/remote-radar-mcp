import { z } from 'zod';

export const workableJobSchema = z.object({
  title: z.string().trim().min(1),
  shortcode: z.string().min(1),
  /** "Full-time", "Part-time", "Contract", "Temporary", or "". */
  employment_type: z.string().nullish(),
  /** Workable's remote flag. Hybrid and on-site jobs are both `false`. */
  telecommuting: z.boolean().nullish(),
  department: z.string().nullish(),
  url: z.url(),
  /** "2026-10-20" (a date, no time). */
  published_on: z.string().nullish(),
  created_at: z.string(),
  locations: z
    .array(
      z.object({
        country: z.string().nullish(),
        countryCode: z.string().nullish(),
        city: z.string().nullish(),
        region: z.string().nullish(),
      }),
    )
    .nullish(),
  description: z.string().nullish(),
});
export type WorkableJob = z.infer<typeof workableJobSchema>;
