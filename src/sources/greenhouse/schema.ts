import { z } from 'zod';

export const greenhouseJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().trim().min(1),
  absolute_url: z.url(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  first_published: z.string().nullish(),
  updated_at: z.string(),
  /** HTML, entity-escaped ("&lt;p&gt;…"). */
  content: z.string().nullish(),
  departments: z.array(z.object({ name: z.string() })).nullish(),
  /** Custom fields; some companies expose an employment type here. */
  metadata: z.array(z.object({ name: z.string(), value: z.unknown() })).nullish(),
});
export type GreenhouseJob = z.infer<typeof greenhouseJobSchema>;
