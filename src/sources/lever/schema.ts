import { z } from 'zod';

export const leverPostingSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
  categories: z
    .object({
      commitment: z.string().nullish(),
      location: z.string().nullish(),
      team: z.string().nullish(),
      department: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
    })
    .nullish(),
  /** ISO 3166-1 alpha-2, or null. */
  country: z.string().nullish(),
  /** remote | hybrid | onsite | on-site | unspecified */
  workplaceType: z.string().nullish(),
  hostedUrl: z.url(),
  /** Unix milliseconds. */
  createdAt: z.number().int().positive(),
  description: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  additional: z.string().nullish(),
  salaryRange: z
    .object({
      currency: z.string().nullish(),
      interval: z.string().nullish(),
      min: z.number().nullish(),
      max: z.number().nullish(),
    })
    .nullish(),
});
export type LeverPosting = z.infer<typeof leverPostingSchema>;
