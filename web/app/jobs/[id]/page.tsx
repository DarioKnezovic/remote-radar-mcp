import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { coverLetterPromptIntro, draftCoverLetter } from 'remote-radar-mcp/domain';
import { CoverLetterEditor } from '@/components/cover-letter';
import { FitPanel } from '@/components/fit-panel';
import { scopeTone } from '@/components/job-card';
import { SaveButton } from '@/components/save-button';
import { NotesLog } from '@/components/notes-log';
import { SetupProblem } from '@/components/setup-problem';
import { StatusControls } from '@/components/status-controls';
import { Badge } from '@/components/ui';
import { fitFor } from '@/lib/fit';
import { formatDate, postedAgo } from '@/lib/format';
import { EMPLOYMENT_LABELS, SCOPE_LABELS, STATUS_LABELS } from '@/lib/labels';
import { loadRadar } from '@/lib/load';
import { sanitizeDescription } from '@/lib/sanitize';

type Params = Promise<{ id: string }>;

/** Ids contain ":" and arrive URL-encoded; real ids never contain "%". */
function jobIdFrom(param: string): string {
  return param.includes('%') ? decodeURIComponent(param) : param;
}

async function loadJob(param: string) {
  const loaded = await loadRadar();
  if (!loaded.ok) return { ok: false, error: loaded.error } as const;
  const job = await loaded.radar.tracker.getJob(jobIdFrom(param));
  return { ok: true, radar: loaded.radar, job } as const;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const loaded = await loadJob((await params).id);
  return {
    title: loaded.ok && loaded.job ? `${loaded.job.title} at ${loaded.job.company}` : 'Job',
  };
}

export default async function JobPage({ params }: { params: Params }) {
  const loaded = await loadJob((await params).id);
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const { radar, job } = loaded;
  if (!job) notFound();

  const [profileResult, saved, history, coverLetter] = await Promise.all([
    radar.profiles.load(),
    radar.tracker.getSavedJob(job.id),
    radar.tracker.getStatusHistory(job.id),
    radar.tracker.getCoverLetter(job.id),
  ]);
  const fit = profileResult.ok ? fitFor(job, profileResult.profile) : undefined;
  const source = radar.sources.find((s) => s.id === job.source);
  const scope = SCOPE_LABELS[job.remote_scope];

  return (
    <article>
      <Link href="/jobs" className="text-accent text-sm hover:underline">
        ← Back to jobs
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>
        <p className="text-muted mt-1 text-lg">{job.company}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone={scopeTone(job.remote_scope)}>{scope.label}</Badge>
          {job.employment_type !== 'unknown' && (
            <Badge>{EMPLOYMENT_LABELS[job.employment_type]}</Badge>
          )}
          {job.salary && <Badge tone="good">{job.salary}</Badge>}
        </div>
        <dl className="text-muted mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-text font-medium">Where from</dt>
          <dd>
            {scope.hint}
            {job.location && ` Listing says: “${job.location}”.`}
          </dd>
          <dt className="text-text font-medium">Posted</dt>
          <dd>
            {postedAgo(job.published_at)} ({formatDate(job.published_at)})
          </dd>
          <dt className="text-text font-medium">Found on</dt>
          <dd>
            {source ? (
              <a
                href={source.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {source.name}
              </a>
            ) : (
              job.source
            )}
          </dd>
        </dl>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent rounded-lg px-4 py-2 text-sm font-medium text-white dark:text-black"
        >
          Open the original listing ↗
        </a>
        <SaveButton jobId={job.id} saved={saved !== undefined} />
      </div>
      <p className="text-muted mt-2 text-sm">
        You apply on the original listing. Remote Radar never applies for you.
      </p>

      {saved && (
        <section
          aria-labelledby="tracker-heading"
          className="bg-surface border-border mt-6 rounded-xl border p-5"
        >
          <h2 id="tracker-heading" className="font-semibold">
            In My jobs: {STATUS_LABELS[saved.status].label}
          </h2>
          <p className="text-muted mt-1 text-sm">
            Saved on {formatDate(saved.saved_at)}. {STATUS_LABELS[saved.status].hint}{' '}
            <Link href="/tracker" className="text-accent hover:underline">
              Open My jobs
            </Link>
          </p>
          <div className="mt-4">
            <StatusControls key={saved.status} jobId={job.id} status={saved.status} />
          </div>
          {saved.notes && (
            <div className="border-border mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">Notes</h3>
              <NotesLog notes={saved.notes} />
            </div>
          )}
          {history.length > 0 && (
            <details className="border-border mt-4 border-t pt-4 text-sm">
              <summary className="text-muted cursor-pointer">History</summary>
              <ol className="mt-2 space-y-1">
                {history.map((entry, i) => (
                  <li key={i} className="text-muted">
                    <span className="tabular-nums">
                      {formatDate(entry.changed_at.toISOString())}
                    </span>
                    {' · '}
                    {entry.from_status
                      ? `${STATUS_LABELS[entry.from_status].label} → ${STATUS_LABELS[entry.to_status].label}`
                      : 'Saved to My jobs'}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      <details
        open={coverLetter !== undefined}
        className="bg-surface border-border group mt-6 rounded-xl border"
      >
        <summary className="cursor-pointer list-none p-5">
          <span className="font-semibold">✍️ Cover letter draft</span>
          <span className="text-muted ml-2 text-sm">
            {coverLetter
              ? `saved ${formatDate(coverLetter.updated_at)}`
              : 'a first draft from your profile, to edit and send yourself'}
          </span>
          <span aria-hidden className="text-muted float-right group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-border border-t p-5">
          {profileResult.ok && fit ? (
            <CoverLetterEditor
              jobId={job.id}
              generated={draftCoverLetter({ job, profile: profileResult.profile, fit })}
              saved={coverLetter}
              promptIntro={coverLetterPromptIntro({ job, profile: profileResult.profile, fit })}
            />
          ) : (
            <p className="text-muted text-sm">
              Set up your profile first, and Remote Radar writes a first draft from it.{' '}
              <Link href="/profile" className="text-accent hover:underline">
                Set up my profile
              </Link>
            </p>
          )}
        </div>
      </details>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section aria-labelledby="description-heading" className="min-w-0 lg:order-1">
          <h2 id="description-heading" className="mb-3 text-lg font-semibold">
            The listing
          </h2>
          <div
            className="listing bg-surface border-border rounded-xl border p-5"
            // Sanitized: only basic formatting tags survive (see lib/sanitize.ts).
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(job.description) }}
          />
          <p className="text-muted mt-3 text-xs">
            Listing text from {source?.name ?? job.source}. It may have changed since; the original
            listing is always the current version.
          </p>
        </section>
        <div className="lg:sticky lg:top-6 lg:order-2">
          <FitPanel fit={fit} />
        </div>
      </div>
    </article>
  );
}
