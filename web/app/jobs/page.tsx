import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Profile, RemoteRadar } from 'remote-radar-mcp/app';
import { JobCard } from '@/components/job-card';
import { SetupProblem } from '@/components/setup-problem';
import { Callout, PageHeader } from '@/components/ui';
import { fitFor, fitScore } from '@/lib/fit';
import { formatDate, plural } from '@/lib/format';
import { loadRadar } from '@/lib/load';
import { CURRENCIES, RATES_DATE } from 'remote-radar-mcp/domain';
import {
  currencyFor,
  DAYS_OPTIONS,
  PAGE_SIZE,
  parseQuery,
  queryHref,
  scopesFor,
  SORT_OPTIONS,
  WHERE_OPTIONS,
  type JobQuery,
} from '@/lib/search';

export const metadata: Metadata = { title: 'Find jobs' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const loaded = await loadRadar();
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const { radar } = loaded;

  const profileResult = await radar.profiles.load();
  const profile = profileResult.ok ? profileResult.profile : undefined;
  const query = parseQuery(await searchParams, profile !== undefined, currencyFor(profile));

  return (
    <div>
      <PageHeader
        title="Find jobs"
        intro="Remote jobs from public job boards. Each one is checked against your profile, so you can see at a glance whether it fits you."
      />

      {!profile && (
        <div className="mb-6">
          <Callout tone="warn" title="Set up your profile to see which jobs fit you">
            You can search without it, but Remote Radar can’t warn you about jobs you can’t take.{' '}
            <Link href="/profile" className="font-medium underline underline-offset-2">
              Set up my profile
            </Link>
          </Callout>
        </div>
      )}

      <SearchForm query={query} hasProfile={profile !== undefined} />

      {/* A new search shows the loading state; "Show more" keeps the current list meanwhile. */}
      <Suspense
        key={queryHref(query, { show: PAGE_SIZE })}
        fallback={<ResultsLoading count={radar.sources.length} />}
      >
        <Results radar={radar} profile={profile} query={query} />
      </Suspense>
    </div>
  );
}

const fieldClass =
  'bg-surface border-border w-full rounded-lg border px-3 py-2 text-sm focus:border-accent focus:outline-none';

function SearchForm({ query, hasProfile }: { query: JobQuery; hasProfile: boolean }) {
  return (
    <Form action="/jobs" className="bg-surface border-border mb-8 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Keywords</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            maxLength={200}
            placeholder="Keywords, e.g. React, frontend, TypeScript"
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          className="bg-accent rounded-lg px-5 py-2 text-sm font-medium text-white dark:text-black"
        >
          Search
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-muted mb-1 block">Where can you work from?</span>
          <select name="where" defaultValue={query.where} className={fieldClass}>
            {Object.entries(WHERE_OPTIONS)
              .filter(([value]) => hasProfile || value !== 'mine')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted mb-1 block">Posted</span>
          <select name="days" defaultValue={String(query.days)} className={fieldClass}>
            {Object.entries(DAYS_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="text-muted mb-1">Minimum salary a year</legend>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Amount</span>
              <input
                type="text"
                inputMode="numeric"
                name="pay"
                defaultValue={query.pay ? query.pay.toLocaleString('en-US') : ''}
                placeholder="Any"
                maxLength={12}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="sr-only">Currency</span>
              <select name="currency" defaultValue={query.currency} className={fieldClass}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        {hasProfile && (
          <label className="text-sm">
            <span className="text-muted mb-1 block">Order</span>
            <select name="sort" defaultValue={query.sort} className={fieldClass}>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {hasProfile && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="clean"
              value="1"
              defaultChecked={query.clean}
              className="accent-accent size-4"
            />
            Only show jobs with no warnings for me
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="paid"
            value="1"
            defaultChecked={query.paid}
            className="accent-accent size-4"
          />
          Only jobs that state a salary
        </label>
      </div>
      <p className="text-muted mt-2 text-xs leading-relaxed">
        Most jobs don’t state a salary. They stay in the list unless you tick “Only jobs that state
        a salary”. Hourly and day rates count as full-time pay for a year. Other currencies are
        converted with rough exchange rates from {formatDate(RATES_DATE)}.
      </p>
    </Form>
  );
}

function ResultsLoading({ count }: { count: number }) {
  return (
    <div aria-live="polite" className="space-y-3">
      <p className="text-muted text-sm">
        Checking {count} job sources… This takes a moment when the job lists need refreshing (at
        most every few hours).
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface border-border h-36 animate-pulse rounded-xl border" />
      ))}
    </div>
  );
}

async function Results({
  radar,
  profile,
  query,
}: {
  radar: RemoteRadar;
  profile: Profile | undefined;
  query: JobQuery;
}) {
  const [result, saved] = await Promise.all([
    radar.search.search({
      query: query.q || undefined,
      remoteScopes: scopesFor(query.where, profile),
      postedWithinDays: query.days || undefined,
      minSalary: query.pay ? { amount: query.pay, currency: query.currency } : undefined,
      salaryListed: query.paid || undefined,
      // Everything: fit filtering, sorting and "Show more" happen here, on the full list.
      limit: 100_000,
    }),
    radar.tracker.listSavedJobs(),
  ]);
  const savedIds = new Set(saved.map((s) => s.job.id));
  const sourceNames = new Map(result.sources.map((s) => [s.id, s.name]));

  // Fit for every match only when needed for filtering or sorting; else only for the visible page.
  const needAllFits = profile !== undefined && (query.clean || query.sort === 'fit');
  let rows = result.jobs.map((job) => ({
    job,
    fit: needAllFits && profile ? fitFor(job, profile) : undefined,
  }));
  if (query.clean) rows = rows.filter((row) => row.fit?.red_flags.length === 0);
  if (query.sort === 'fit') {
    rows = rows.toSorted((a, b) => (b.fit ? fitScore(b.fit) : 0) - (a.fit ? fitScore(a.fit) : 0));
  }
  const visible = rows
    .slice(0, query.show)
    .map((row) => ({ ...row, fit: row.fit ?? (profile ? fitFor(row.job, profile) : undefined) }));

  const failed = result.sources.filter((s) => !s.ok);
  const fetched = result.sources.reduce((sum, s) => sum + s.fetched, 0);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold">{plural(rows.length, 'job')} found</h2>
        <details className="text-muted text-sm">
          <summary className="cursor-pointer">
            Searched {plural(result.sources.length - failed.length, 'source')} ·{' '}
            {plural(fetched, 'listing')}
            {result.duplicatesRemoved > 0 &&
              ` · ${plural(result.duplicatesRemoved, 'duplicate')} removed`}
          </summary>
          <ul className="mt-2 space-y-0.5">
            {result.sources.map((s) => (
              <li key={s.id}>
                {s.ok ? '✓' : '✕'} {s.name}:{' '}
                {s.ok ? plural(s.fetched, 'listing') : 'didn’t respond'}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {failed.length > 0 && (
        <div className="mb-4">
          <Callout tone="warn" title={`${failed.map((s) => s.name).join(', ')} didn’t respond`}>
            Their jobs are missing from this search. Remote Radar will try again in a few minutes.
          </Callout>
        </div>
      )}

      {rows.length === 0 ? (
        <Callout tone="neutral" title="No jobs match this search">
          Try fewer or different words
          {query.where !== 'all' && ', or choose “All remote jobs”'}
          {query.clean && ', or allow jobs with warnings'}
          {query.pay > 0 && ', or lower the minimum salary'}
          {query.paid && ', or include jobs that don’t state a salary'}.
        </Callout>
      ) : (
        <ul className="space-y-3">
          {visible.map(({ job, fit }) => (
            <li key={job.id}>
              <JobCard
                job={job}
                fit={fit}
                saved={savedIds.has(job.id)}
                sourceName={sourceNames.get(job.source) ?? job.source}
              />
            </li>
          ))}
        </ul>
      )}

      {rows.length > visible.length && (
        <div className="mt-6 text-center">
          <Link
            href={queryHref(query, { show: query.show + PAGE_SIZE })}
            scroll={false}
            className="border-border bg-surface hover:bg-surface-muted inline-block rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Show more ({plural(rows.length - visible.length, 'more job')})
          </Link>
        </div>
      )}
    </div>
  );
}
