'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import {
  canonicalSkill,
  EMPLOYMENT_TYPES,
  SKILL_NAMES,
  type EmploymentType,
  type Profile,
  type ProfileInput,
} from 'remote-radar-mcp/domain';
import type { ProfileIssue } from 'remote-radar-mcp/app';
import { saveProfileAction } from '@/app/actions';
import { EMPLOYMENT_LABELS } from '@/lib/labels';
import { TagInput } from './tag-input';

export interface Choice {
  value: string;
  label: string;
}

interface Story {
  title: string;
  summary: string;
  skills: string[];
}

/** The form's own shape: flat, with text for the number field. */
interface FormState {
  comment: string | undefined;
  name: string;
  countryCode: string;
  /** Kept as written in the profile unless the country is changed in the form. */
  countryName: string;
  city: string;
  timezone: string;
  citizenship: string[];
  years: string;
  strong: string[];
  some: string[];
  learning: string[];
  languages: string[];
  roles: string[];
  employmentTypes: EmploymentType[];
  stories: Story[];
}

function fromProfile(profile: Profile | undefined): FormState {
  return {
    comment: profile?.$comment,
    name: profile?.name ?? '',
    countryCode: profile?.location.country_code ?? '',
    countryName: profile?.location.country ?? '',
    city: profile?.location.city ?? '',
    timezone: profile?.location.timezone ?? '',
    citizenship: profile?.citizenship ?? [],
    years: profile?.years_experience == null ? '' : String(profile.years_experience),
    strong: profile?.skills.strong ?? [],
    some: profile?.skills.some ?? [],
    learning: profile?.skills.learning ?? [],
    languages: profile?.languages ?? [],
    roles: profile?.looking_for.roles ?? [],
    employmentTypes: profile?.looking_for.employment_types ?? ['full_time'],
    stories: profile?.stories ?? [],
  };
}

function toInput(state: FormState, countries: Map<string, string>): ProfileInput {
  const years = state.years.trim();
  return {
    ...(state.comment && { $comment: state.comment }),
    ...(state.name.trim() && { name: state.name.trim() }),
    location: {
      ...(state.city.trim() && { city: state.city.trim() }),
      country: state.countryName || (countries.get(state.countryCode) ?? ''),
      country_code: state.countryCode,
      timezone: state.timezone,
    },
    citizenship: state.citizenship,
    years_experience: years === '' ? null : Number(years),
    skills: { strong: state.strong, some: state.some, learning: state.learning },
    languages: state.languages,
    looking_for: { roles: state.roles, employment_types: state.employmentTypes },
    stories: state.stories.filter((s) => s.title.trim() || s.summary.trim()),
  };
}

/** Plain-language names for the fields the server can complain about. */
const FIELD_NAMES: Record<string, string> = {
  'location.country': 'Country',
  'location.country_code': 'Country',
  'location.timezone': 'Time zone',
  citizenship: 'Citizenship',
  years_experience: 'Years of experience',
  stories: 'Achievements',
};

function fieldName(path: string): string {
  const exact = FIELD_NAMES[path];
  if (exact) return exact;
  const prefix = Object.keys(FIELD_NAMES).find((key) => path.startsWith(`${key}.`));
  return prefix ? (FIELD_NAMES[prefix] ?? path) : path;
}

const normalizeSkill = (value: string) => canonicalSkill(value) ?? value;
const noSubscription = () => () => undefined;
const CONTRACT_TYPES = EMPLOYMENT_TYPES.filter((type) => type !== 'unknown');

const inputClass =
  'block bg-surface border-border focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:outline-none';

/** Wizard steps for a first-time setup; the full form shows every section at once. */
const STEPS = [
  { title: 'Where you live', sections: ['where', 'citizenship'] },
  { title: 'Your skills', sections: ['skills', 'experience'] },
  { title: 'What you’re looking for', sections: ['languages', 'looking'] },
] as const;
type SectionId =
  'about' | 'where' | 'citizenship' | 'skills' | 'experience' | 'languages' | 'looking' | 'stories';

export function ProfileForm({
  mode,
  initial,
  countries,
  timezones,
  languages,
}: {
  mode: 'wizard' | 'full';
  initial: Profile | undefined;
  countries: Choice[];
  timezones: string[];
  languages: readonly string[];
}) {
  const [state, setState] = useState(() => fromProfile(initial));
  const [step, setStep] = useState(0);
  const [issues, setIssues] = useState<ProfileIssue[]>([]);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const countryNames = new Map(countries.map((c) => [c.value, c.label]));

  // A sensible default for new users: the time zone their browser is in. Read during render
  // (empty on the server), not copied into state, so the server and browser agree.
  const browserZone = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => '',
  );
  const timezone = state.timezone || browserZone;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false);
    setState((s) => ({ ...s, [key]: value }));
  };

  function save() {
    setError(undefined);
    setIssues([]);
    startTransition(async () => {
      const result = await saveProfileAction(toInput({ ...state, timezone }, countryNames));
      if (result.ok) {
        setSaved(true);
      } else {
        setIssues(result.issues);
        setError(result.issues.length > 0 ? undefined : result.error);
      }
    });
  }

  /** What's still missing before a wizard step can continue. */
  function missingFor(sections: readonly SectionId[]): string[] {
    const missing: string[] = [];
    if (sections.includes('where')) {
      if (!state.countryCode) missing.push('the country you live in');
      if (!timezone) missing.push('your time zone');
    }
    if (sections.includes('citizenship') && state.citizenship.length === 0) {
      missing.push('at least one citizenship');
    }
    return missing;
  }

  const issuesFor = (...paths: string[]) =>
    issues.filter((issue) => paths.some((p) => issue.path === p || issue.path.startsWith(`${p}.`)));

  const sections: Record<SectionId, ReactNode> = {
    about: (
      <Section title="About you" key="about">
        <label className="block text-sm">
          <span className="font-medium">Your name</span>{' '}
          <span className="text-muted">(optional)</span>
          <input
            value={state.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={100}
            autoComplete="name"
            className={`${inputClass} mt-1 sm:max-w-sm`}
          />
        </label>
      </Section>
    ),
    where: (
      <Section
        title="Where you live"
        hint="Many remote jobs only hire in some countries. This is how Remote Radar knows which ones are open to you."
        issues={issuesFor('location')}
        key="where"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Country</span>
            <select
              value={state.countryCode}
              onChange={(e) => {
                setSaved(false);
                const code = e.target.value;
                setState((s) => ({
                  ...s,
                  countryCode: code,
                  countryName: countryNames.get(code) ?? '',
                }));
              }}
              className={`${inputClass} mt-1`}
            >
              <option value="">Choose…</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">City</span> <span className="text-muted">(optional)</span>
            <input
              value={state.city}
              onChange={(e) => update('city', e.target.value)}
              maxLength={100}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Time zone</span>
            <select
              value={timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">Choose…</option>
              {!timezones.includes(timezone) && timezone && (
                <option value={timezone}>{timezone}</option>
              )}
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>
    ),
    citizenship: (
      <Section
        title="Citizenship"
        hint="Some jobs need the right to work in a country. A citizenship of any EU country counts for all of them. Add every citizenship you have."
        issues={issuesFor('citizenship')}
        key="citizenship"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {state.citizenship.map((code) => (
            <span
              key={code}
              className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm"
            >
              {countryNames.get(code) ?? code}
              <button
                type="button"
                aria-label={`Remove ${countryNames.get(code) ?? code}`}
                onClick={() =>
                  update(
                    'citizenship',
                    state.citizenship.filter((c) => c !== code),
                  )
                }
                className="hover:bg-accent/15 rounded-full px-1.5 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <label className="text-sm">
            <span className="sr-only">Add a citizenship</span>
            <select
              value=""
              onChange={(e) =>
                e.target.value &&
                !state.citizenship.includes(e.target.value) &&
                update('citizenship', [...state.citizenship, e.target.value])
              }
              className="bg-surface border-border rounded-lg border px-2 py-1.5 text-sm"
            >
              <option value="">+ Add a citizenship…</option>
              {countries
                .filter((c) => !state.citizenship.includes(c.value))
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </Section>
    ),
    skills: (
      <Section
        title="Skills"
        hint="Type a skill and press Enter. Common spellings are understood: “node” becomes Node.js."
        key="skills"
      >
        <div className="space-y-4">
          <TagInput
            label="Strong: you use these every day"
            values={state.strong}
            onChange={(v) => update('strong', v)}
            suggestions={SKILL_NAMES}
            normalize={normalizeSkill}
            placeholder="e.g. TypeScript, React"
          />
          <TagInput
            label="Some experience"
            values={state.some}
            onChange={(v) => update('some', v)}
            suggestions={SKILL_NAMES}
            normalize={normalizeSkill}
            placeholder="e.g. Docker"
          />
          <TagInput
            label="Learning"
            values={state.learning}
            onChange={(v) => update('learning', v)}
            suggestions={SKILL_NAMES}
            normalize={normalizeSkill}
            placeholder="e.g. Python"
          />
        </div>
      </Section>
    ),
    experience: (
      <Section
        title="Experience"
        hint="Used to point out jobs that ask for clearly more years. Leave it empty if you’d rather not say."
        issues={issuesFor('years_experience')}
        key="experience"
      >
        <label className="block text-sm">
          <span className="font-medium">Years of professional experience</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={state.years}
            onChange={(e) => update('years', e.target.value)}
            className={`${inputClass} mt-1 w-28`}
          />
        </label>
      </Section>
    ),
    languages: (
      <Section
        title="Languages"
        hint="The languages you could work in. Jobs that require another language get a warning."
        key="languages"
      >
        <TagInput
          label="Languages you can work in"
          values={state.languages}
          onChange={(v) => update('languages', v)}
          suggestions={languages}
          placeholder="e.g. English"
        />
      </Section>
    ),
    looking: (
      <Section title="What you’re looking for" key="looking">
        <div className="space-y-4">
          <TagInput
            label="Roles"
            hint="For your own overview and for drafting applications."
            values={state.roles}
            onChange={(v) => update('roles', v)}
            placeholder="e.g. Frontend lead, Full-stack engineer"
          />
          <fieldset>
            <legend className="text-sm font-medium">Types of contract</legend>
            <p className="text-muted text-sm">Jobs of other types get a warning.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {CONTRACT_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.employmentTypes.includes(type)}
                    onChange={(e) =>
                      update(
                        'employmentTypes',
                        e.target.checked
                          ? [...state.employmentTypes, type]
                          : state.employmentTypes.filter((t) => t !== type),
                      )
                    }
                    className="accent-accent size-4"
                  />
                  {EMPLOYMENT_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>
    ),
    stories: (
      <Section
        title="Achievements"
        hint="Optional. Short stories of things you did, with numbers if you have them. Claude uses them when helping you write an application."
        issues={issuesFor('stories')}
        key="stories"
      >
        <div className="space-y-4">
          {state.stories.map((story, i) => (
            <div key={i} className="border-border space-y-3 rounded-lg border p-4">
              <label className="block text-sm">
                <span className="font-medium">Title</span>
                <input
                  value={story.title}
                  onChange={(e) =>
                    update(
                      'stories',
                      state.stories.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                    )
                  }
                  maxLength={150}
                  placeholder="e.g. Cut checkout load time in half"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">What you did, and the result</span>
                <textarea
                  value={story.summary}
                  onChange={(e) =>
                    update(
                      'stories',
                      state.stories.map((s, j) =>
                        j === i ? { ...s, summary: e.target.value } : s,
                      ),
                    )
                  }
                  rows={3}
                  maxLength={1000}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <TagInput
                label="Skills used"
                values={story.skills}
                onChange={(v) =>
                  update(
                    'stories',
                    state.stories.map((s, j) => (j === i ? { ...s, skills: v } : s)),
                  )
                }
                suggestions={SKILL_NAMES}
                normalize={normalizeSkill}
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    'stories',
                    state.stories.filter((_, j) => j !== i),
                  )
                }
                className="text-bad text-sm hover:underline"
              >
                Remove this achievement
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update('stories', [...state.stories, { title: '', summary: '', skills: [] }])
            }
            className="border-border bg-surface hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm font-medium"
          >
            + Add an achievement
          </button>
        </div>
      </Section>
    ),
  };

  if (saved && mode === 'wizard') {
    return (
      <div className="bg-good-soft rounded-xl p-6">
        <h2 className="text-good text-lg font-semibold">✓ Your profile is ready</h2>
        <p className="mt-1">
          Remote Radar now checks every job against it. You can change it here any time.
        </p>
        <Link
          href="/jobs"
          className="bg-accent mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white dark:text-black"
        >
          Find jobs that fit me →
        </Link>
      </div>
    );
  }

  const feedback = (
    <>
      {(error || issues.length > 0) && (
        <div role="alert" className="bg-bad-soft text-bad rounded-xl p-4 text-sm">
          <p className="font-medium">Not saved. Please check:</p>
          {error && <p className="mt-1">{error}</p>}
          <ul className="mt-1 list-disc pl-5">
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                {fieldName(issue.path)}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {saved && (
        <p role="status" className="text-good text-sm font-medium">
          ✓ Saved. Every page now uses your updated profile.
        </p>
      )}
    </>
  );

  if (mode === 'wizard') {
    const current = STEPS[step] ?? STEPS[0];
    const missing = missingFor(current.sections);
    const last = step === STEPS.length - 1;
    return (
      <div>
        <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              aria-current={i === step ? 'step' : undefined}
              className={`rounded-full px-3 py-1 ${
                i === step
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'bg-surface-muted text-muted'
              }`}
            >
              {i + 1}. {s.title}
            </li>
          ))}
        </ol>
        <div className="space-y-6">{current.sections.map((id) => sections[id])}</div>
        <div className="mt-6 space-y-3">
          {feedback}
          {missing.length > 0 && (
            <p className="text-muted text-sm">To continue, add {missing.join(' and ')}.</p>
          )}
          <div className="flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="border-border bg-surface hover:bg-surface-muted rounded-lg border px-4 py-2 text-sm font-medium"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              disabled={missing.length > 0 || pending}
              onClick={() => (last ? save() : setStep(step + 1))}
              className="bg-accent rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:text-black"
            >
              {last ? (pending ? 'Saving…' : 'Save my profile') : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const order: SectionId[] = [
    'about',
    'where',
    'citizenship',
    'skills',
    'experience',
    'languages',
    'looking',
    'stories',
  ];
  const missing = missingFor(['where', 'citizenship']);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="space-y-6">{order.map((id) => sections[id])}</div>
      <div className="bg-bg/90 border-border sticky bottom-0 mt-6 space-y-3 border-t py-4 backdrop-blur">
        {feedback}
        {missing.length > 0 && (
          <p className="text-muted text-sm">Add {missing.join(' and ')} to save.</p>
        )}
        <button
          type="submit"
          disabled={missing.length > 0 || pending}
          className="bg-accent rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:text-black"
        >
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  issues = [],
  children,
}: {
  title: string;
  hint?: string;
  issues?: ProfileIssue[];
  children: ReactNode;
}) {
  return (
    <section className="bg-surface border-border rounded-xl border p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">{hint}</p>}
      <div className="mt-4">{children}</div>
      {issues.map((issue) => (
        <p key={`${issue.path}-${issue.message}`} className="text-bad mt-2 text-sm">
          {issue.message}
        </p>
      ))}
    </section>
  );
}
