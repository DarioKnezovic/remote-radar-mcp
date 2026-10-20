import type {
  ApplicationStatus,
  EmploymentType,
  RedFlagCode,
  RemoteScope,
  SourceId,
} from 'remote-radar-mcp/domain';

/** Where a job can be done from, in words anyone understands. */
export const SCOPE_LABELS: Record<RemoteScope, { label: string; hint: string }> = {
  Worldwide: { label: 'From anywhere', hint: 'Open to people in any country.' },
  Europe: {
    label: 'From Europe',
    hint: 'Open to people living in Europe (sometimes only some countries).',
  },
  'EU only': { label: 'From EU countries', hint: 'Open to people in the European Union.' },
  'US only': { label: 'From the US only', hint: 'Only for people living in the United States.' },
  Americas: { label: 'From the Americas', hint: 'North and/or South America.' },
  'Multi-region': {
    label: 'From several regions',
    hint: 'The listing names more than one region.',
  },
  Other: { label: 'From one other region', hint: 'For example Asia or Australia only.' },
  Unknown: {
    label: 'Not stated',
    hint: 'Remote, but the listing doesn’t say from where. Check before applying.',
  },
  'On-site': {
    label: 'Office / not remote',
    hint: 'Needs you in an office, at least part of the time.',
  },
};

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
  unknown: 'Type not stated',
};

/** The application stages, in the order a job moves through them. */
export const STATUS_LABELS: Record<ApplicationStatus, { label: string; hint: string }> = {
  found: { label: 'Saved', hint: 'You saved it. You haven’t applied yet.' },
  applied: { label: 'Applied', hint: 'You sent an application yourself.' },
  interview: { label: 'Interviewing', hint: 'You’re talking to the company.' },
  offer: { label: 'Offer', hint: 'They made you an offer.' },
  rejected: { label: 'Rejected', hint: 'It didn’t work out this time.' },
  skipped: { label: 'Not interested', hint: 'You decided not to apply.' },
};

/** What each warning means and what to do about it. */
export const RED_FLAG_LABELS: Record<RedFlagCode, { title: string; explain: string }> = {
  on_site: {
    title: 'Not remote',
    explain: 'The job is in an office. Only apply if you can move or commute there.',
  },
  hybrid: {
    title: 'Hybrid',
    explain: 'You’d need to be in an office regularly, so you’d have to live nearby.',
  },
  region_restricted: {
    title: 'May not hire where you live',
    explain:
      'The listing limits which countries or regions people can work from, and yours may not be one of them.',
  },
  residence_required: {
    title: 'Must live in a specific place',
    explain: 'The listing says you must live in a certain country or region.',
  },
  work_authorization: {
    title: 'Needs a work permit you may not have',
    explain:
      'The listing asks for the legal right to work in a country your citizenship doesn’t cover.',
  },
  language_required: {
    title: 'Needs a language you didn’t list',
    explain: 'The listing requires a language that isn’t in your profile.',
  },
  posting_language: {
    title: 'Written in another language',
    explain: 'The whole listing is in a language you didn’t list, so the job probably needs it.',
  },
  employment_type: {
    title: 'Different type of contract',
    explain: 'For example part-time, when you’re looking for full-time or contract work.',
  },
  unpaid: {
    title: 'May be unpaid',
    explain: 'It looks unpaid, or paid only in equity or commission.',
  },
  timezone: {
    title: 'Different working hours',
    explain: 'It expects you to work in US hours, which is late evening or night where you are.',
  },
  experience: {
    title: 'Asks for more experience',
    explain: 'It asks for clearly more years of experience than your profile says.',
  },
};

/** What each source is, for "how it works" and attribution. */
export const SOURCE_DESCRIPTIONS: Record<SourceId, string> = {
  remotive: 'A remote-jobs board with a free public API. Small: it returns about 10 recent jobs.',
  arbeitnow: 'A European job board (many jobs in Germany) with a free public API.',
  remoteok: 'A large remote-jobs board with a public feed. Links always go back to Remote OK.',
  greenhouse: 'Hiring software many companies use. We read their public job boards directly.',
  lever: 'Hiring software many companies use. We read their public job boards directly.',
  ashby: 'Hiring software many companies use. We read their public job boards directly.',
};
