import { z } from 'zod';

export const SOURCE_IDS = [
  'remotive',
  'arbeitnow',
  'remoteok',
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'smartrecruiters',
  'recruitee',
] as const;
export const sourceIdSchema = z.enum(SOURCE_IDS);
export type SourceId = z.infer<typeof sourceIdSchema>;

/**
 * Where a remote job can be done from, normalized from each source's free-text location.
 * `Multi-region` means the listing names several regions (e.g. "Europe, USA, APAC");
 * the raw text stays in `location` so filters can still check which regions are included.
 */
export const REMOTE_SCOPES = [
  'Worldwide',
  'Europe',
  'EU only',
  'US only',
  'Americas',
  'Multi-region',
  'Other',
  'Unknown',
  'On-site',
] as const;
export const remoteScopeSchema = z.enum(REMOTE_SCOPES);
export type RemoteScope = z.infer<typeof remoteScopeSchema>;

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'freelance',
  'internship',
  'unknown',
] as const;
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

/** The single shape every source is normalized into. */
export const jobSchema = z.object({
  /**
   * Globally unique: `<source>:<source_job_id>`, e.g. `remotive:2091158`. Company-board
   * sources include the board: `greenhouse:gitlab:8860302002`.
   */
  id: z.string().min(1),
  source: sourceIdSchema,
  source_job_id: z.string().min(1),
  /** Link to the original listing — where the user applies. */
  url: z.url(),
  title: z.string().min(1),
  company: z.string().min(1),
  /** Raw location text from the source, if any. */
  location: z.string().nullable(),
  remote_scope: remoteScopeSchema,
  employment_type: employmentTypeSchema,
  /** Raw salary text as the listing states it; `parseSalary` (salary.ts) reads it when needed. */
  salary: z.string().nullable(),
  tags: z.array(z.string()),
  /** HTML as provided by the source. */
  description: z.string(),
  /** ISO 8601, UTC. */
  published_at: z.iso.datetime(),
});
export type Job = z.infer<typeof jobSchema>;

export function makeJobId(source: SourceId, sourceJobId: string): string {
  return `${source}:${sourceJobId}`;
}
