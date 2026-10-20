import { z } from 'zod';

export const ashbyJobSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  department: z.string().nullish(),
  team: z.string().nullish(),
  /** FullTime | PartTime | Intern | Contract | Temporary */
  employmentType: z.string().nullish(),
  location: z.string().nullish(),
  secondaryLocations: z.array(z.object({ location: z.string().nullish() })).nullish(),
  isRemote: z.boolean().nullish(),
  /** OnSite | Remote | Hybrid */
  workplaceType: z.string().nullish(),
  isListed: z.boolean().nullish(),
  publishedAt: z.string(),
  jobUrl: z.url(),
  descriptionHtml: z.string().nullish(),
  address: z
    .object({ postalAddress: z.object({ addressCountry: z.string().nullish() }).nullish() })
    .nullish(),
  compensation: z
    .object({
      compensationTierSummary: z.string().nullish(),
      scrapeableCompensationSalarySummary: z.string().nullish(),
    })
    .nullish(),
});
export type AshbyJob = z.infer<typeof ashbyJobSchema>;
