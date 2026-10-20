import { z } from 'zod';
import { employmentTypeSchema } from './job.js';

const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'expected an ISO 3166-1 alpha-2 code, e.g. "HR"')
  .transform((code) => code.toUpperCase());

const skillList = z.array(z.string().trim().min(1)).default([]);

/** The local `profile.json` that match_job compares jobs against. */
export const profileSchema = z.object({
  $comment: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  location: z.object({
    city: z.string().trim().min(1).optional(),
    country: z.string().trim().min(1),
    country_code: countryCode,
    /** e.g. "CET", "Europe/Sarajevo". */
    timezone: z.string().trim().min(1),
  }),
  /** Every citizenship you hold, as country codes. EU citizenship = EU work authorization. */
  citizenship: z.array(countryCode).min(1),
  years_experience: z.number().int().min(0).max(60).nullable().default(null),
  skills: z.object({
    strong: skillList,
    some: skillList,
    learning: skillList,
  }),
  /** Languages you can work in, by English name: "English", "Croatian". */
  languages: z.array(z.string().trim().min(1)).default([]),
  looking_for: z
    .object({
      roles: z.array(z.string().trim().min(1)).default([]),
      employment_types: z.array(employmentTypeSchema).default([]),
    })
    .default({ roles: [], employment_types: [] }),
  /** Short achievement stories, for drafting tailored applications. */
  stories: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        skills: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
});
export type Profile = z.infer<typeof profileSchema>;
/** What a profile form may send: optional lists can be left out. */
export type ProfileInput = z.input<typeof profileSchema>;

export type SkillLevel = 'strong' | 'some' | 'learning';
