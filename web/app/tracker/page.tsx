import type { Metadata } from 'next';
import Link from 'next/link';
import type { ApplicationStatus, SavedJob } from 'remote-radar-mcp/domain';
import { scopeTone } from '@/components/job-card';
import { NotesLog } from '@/components/notes-log';
import { SetupProblem } from '@/components/setup-problem';
import { StatusControls } from '@/components/status-controls';
import { Badge, Callout, PageHeader } from '@/components/ui';
import { formatDate, jobHref } from '@/lib/format';
import { SCOPE_LABELS, STATUS_LABELS } from '@/lib/labels';
import { loadRadar } from '@/lib/load';

export const metadata: Metadata = { title: 'My jobs' };

/** The stages a job moves through while it's still open, left to right. */
const OPEN: readonly ApplicationStatus[] = ['found', 'applied', 'interview', 'offer'];
const CLOSED: readonly ApplicationStatus[] = ['rejected', 'skipped'];

export default async function TrackerPage() {
  const loaded = await loadRadar();
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const saved = await loaded.radar.tracker.listSavedJobs();

  const byStatus = (status: ApplicationStatus) => saved.filter((s) => s.status === status);
  const closed = saved.filter((s) => CLOSED.includes(s.status));

  return (
    <div>
      <PageHeader
        title="My jobs"
        intro="The jobs you saved, and where you are with each one. When you’ve applied on the company’s site, mark it here, so you always know what’s next."
      />

      {saved.length === 0 ? (
        <Callout tone="neutral" title="You haven’t saved any jobs yet">
          Find a job you like and press “Save”, and it appears here.{' '}
          <Link href="/jobs" className="font-medium underline underline-offset-2">
            Find jobs
          </Link>
        </Callout>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {OPEN.map((status) => (
              <Column key={status} status={status} jobs={byStatus(status)} />
            ))}
          </div>

          {closed.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-lg font-semibold">
                Closed ({closed.length})
              </summary>
              <p className="text-muted mt-1 text-sm">
                Rejected, or you decided not to apply. Change the status to bring a job back.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {CLOSED.map((status) => (
                  <Column key={status} status={status} jobs={byStatus(status)} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Column({ status, jobs }: { status: ApplicationStatus; jobs: SavedJob[] }) {
  const { label, hint } = STATUS_LABELS[status];
  return (
    <section aria-labelledby={`col-${status}`} className="bg-surface-muted rounded-xl p-3">
      <h2 id={`col-${status}`} className="flex items-baseline justify-between px-1 font-semibold">
        {label}
        <span className="text-muted text-sm font-normal">{jobs.length}</span>
      </h2>
      <p className="text-muted px-1 text-xs">{hint}</p>
      <ul className="mt-3 space-y-3">
        {jobs.length === 0 && (
          <li className="text-muted px-1 py-4 text-center text-sm">Nothing here</li>
        )}
        {jobs.map((saved) => (
          <li key={saved.job.id}>
            <TrackedJob saved={saved} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrackedJob({ saved }: { saved: SavedJob }) {
  const { job } = saved;
  return (
    <article className="bg-surface border-border rounded-lg border p-4">
      <h3 className="font-semibold leading-snug">
        <Link href={jobHref(job.id)} className="hover:underline">
          {job.title}
        </Link>
      </h3>
      <p className="text-muted text-sm">{job.company}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={scopeTone(job.remote_scope)}>{SCOPE_LABELS[job.remote_scope].label}</Badge>
        {job.salary && <Badge tone="good">{job.salary}</Badge>}
      </div>
      <p className="text-muted mt-2 text-xs">
        Saved {formatDate(saved.saved_at)}
        {saved.updated_at !== saved.saved_at && ` · updated ${formatDate(saved.updated_at)}`}
      </p>
      {saved.notes && (
        <div className="border-border mt-3 border-t pt-3">
          <NotesLog notes={saved.notes} limit={2} />
        </div>
      )}
      <div className="border-border mt-3 space-y-2 border-t pt-3">
        <StatusControls key={saved.status} jobId={job.id} status={saved.status} />
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent inline-block text-sm hover:underline"
        >
          Original listing ↗
        </a>
      </div>
    </article>
  );
}
