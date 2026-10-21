import { z } from 'zod';

const labelled = z.object({ label: z.string().nullish() }).nullish();

/** One entry of the postings list; the list has no description or link, so only the id is used. */
export const smartRecruitersListSchema = z.object({
  content: z.array(z.object({ id: z.string().min(1) })),
});

const sectionSchema = z
  .object({ title: z.string().nullish(), text: z.string().nullish() })
  .nullish();

/** `GET /v1/companies/{company}/postings/{id}`. */
export const smartRecruitersPostingSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  postingUrl: z.url(),
  releasedDate: z.string(),
  location: z
    .object({
      city: z.string().nullish(),
      region: z.string().nullish(),
      /** ISO 3166-1 alpha-2, lower case ("de"). */
      country: z.string().nullish(),
      remote: z.boolean().nullish(),
      hybrid: z.boolean().nullish(),
      /** "Munich, BY, Germany"; empty parts stay in ("Sydney, , Australia"). */
      fullLocation: z.string().nullish(),
    })
    .nullish(),
  department: labelled,
  function: labelled,
  /** "Full-time", "Part-time", "Contract", "Internship", … */
  typeOfEmployment: labelled,
  customField: z
    .array(z.object({ fieldLabel: z.string(), valueLabel: z.string().nullish() }))
    .nullish(),
  jobAd: z
    .object({
      sections: z
        .object({
          companyDescription: sectionSchema,
          jobDescription: sectionSchema,
          qualifications: sectionSchema,
          additionalInformation: sectionSchema,
        })
        .nullish(),
    })
    .nullish(),
});
export type SmartRecruitersPosting = z.infer<typeof smartRecruitersPostingSchema>;
