import { z } from 'zod';

/** Recruitee sends salary bounds as strings ("4000"), sometimes "0" or null. */
const amount = z.union([z.number(), z.string()]).nullish();

export const recruiteeOfferSchema = z.object({
  id: z.number().int(),
  title: z.string().trim().min(1),
  careers_url: z.url(),
  department: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  remote: z.boolean().nullish(),
  hybrid: z.boolean().nullish(),
  on_site: z.boolean().nullish(),
  /** "Amsterdam, Noord-Holland, Netherlands", or "Remote job" for remote offers. */
  location: z.string().nullish(),
  /** Where the offer is open; for remote offers, the countries people can work from. */
  locations: z.array(z.object({ country: z.string().nullish() })).nullish(),
  /** fulltime_permanent | fulltime_fixed_term | fulltime | parttime_* | contract | freelance | internship … */
  employment_type_code: z.string().nullish(),
  salary: z
    .object({
      min: amount,
      max: amount,
      /** hour | day | month | year */
      period: z.string().nullish(),
      currency: z.string().nullish(),
    })
    .nullish(),
  description: z.string().nullish(),
  requirements: z.string().nullish(),
  /** "2026-10-15 09:31:36 UTC" */
  published_at: z.string().nullish(),
  created_at: z.string(),
});
export type RecruiteeOffer = z.infer<typeof recruiteeOfferSchema>;
