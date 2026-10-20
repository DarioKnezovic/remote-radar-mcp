import { z } from 'zod';

const numberish = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);

export const remoteOkJobSchema = z.object({
  id: z.union([z.string(), z.number()]),
  /** Unix seconds. */
  epoch: numberish.nullish(),
  /** ISO 8601 with offset. */
  date: z.string().nullish(),
  company: z.string().trim().min(1),
  position: z.string().trim().min(1),
  tags: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  /** Where applicants must be; empty for about half the jobs. */
  location: z.string().nullish(),
  /** Annual USD; 0 means not given. */
  salary_min: numberish.nullish(),
  salary_max: numberish.nullish(),
  /** The Remote OK listing page — the link their terms require. */
  url: z.url(),
});
export type RemoteOkJob = z.infer<typeof remoteOkJobSchema>;
