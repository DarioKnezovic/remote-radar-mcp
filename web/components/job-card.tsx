import Link from 'next/link';
import type { Job, MatchResult, OtherListing } from 'remote-radar-mcp/domain';
import { EMPLOYMENT_LABELS, RED_FLAG_LABELS, SCOPE_LABELS } from '@/lib/labels';
import { jobHref, postedAgo } from '@/lib/format';
import { SaveButton } from './save-button';
import { Badge } from './ui';

export function scopeTone(scope: Job['remote_scope']) {
  if (scope === 'On-site') return 'bad' as const;
  if (scope === 'Unknown') return 'warn' as const;
  return 'accent' as const;
}

/** "Also posted for Remote France, Remote Germany and 4 more places". */
export function alsoPostedFor(others: readonly OtherListing[], shown = 2): string {
  const names = others.slice(0, shown).map((other) => other.location);
  const rest = others.length - names.length;
  if (rest === 0) return `Also posted for ${names.join(' and ')}`;
  return `Also posted for ${names.join(', ')} and ${rest} more ${rest === 1 ? 'place' : 'places'}`;
}

/** One-line fit summary: warnings first, then skills. */
export function FitSummary({ fit }: { fit: MatchResult }) {
  const skillsTotal = fit.matched_skills.length + fit.missing_skills.length;
  const titles = [...new Set(fit.red_flags.map((flag) => RED_FLAG_LABELS[flag.code].title))];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {titles.length === 0 ? (
        <span className="text-good font-medium">✓ No warnings</span>
      ) : (
        <span className="text-warn font-medium">⚠ {titles.join(' · ')}</span>
      )}
      {skillsTotal > 0 && (
        <span className="text-muted">
          You have {fit.matched_skills.length} of {skillsTotal} skills it mentions
        </span>
      )}
    </div>
  );
}

export function JobCard({
  job,
  sourceName,
  fit,
  saved,
  others = [],
}: {
  job: Job;
  sourceName: string;
  fit?: MatchResult | undefined;
  saved: boolean;
  /** The same role posted for other places. */
  others?: readonly OtherListing[] | undefined;
}) {
  const scope = SCOPE_LABELS[job.remote_scope];
  return (
    <article className="bg-surface border-border rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">
          <Link href={jobHref(job.id)} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        <p className="text-muted text-sm">
          {job.company} · posted {postedAgo(job.published_at)} · via {sourceName}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span title={scope.hint}>
          <Badge tone={scopeTone(job.remote_scope)}>{scope.label}</Badge>
        </span>
        {job.employment_type !== 'unknown' && (
          <Badge>{EMPLOYMENT_LABELS[job.employment_type]}</Badge>
        )}
        {job.salary && <Badge tone="good">{job.salary}</Badge>}
      </div>
      {job.location && <p className="text-muted mt-2 line-clamp-1 text-sm">📍 {job.location}</p>}
      {others.length > 0 && (
        <p className="text-muted mt-1 line-clamp-2 text-sm">🌍 {alsoPostedFor(others)}</p>
      )}

      {fit && (
        <div className="border-border mt-3 border-t pt-3">
          <FitSummary fit={fit} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={jobHref(job.id)}
          className="bg-accent rounded-lg px-3 py-1.5 text-sm font-medium text-white dark:text-black"
        >
          See details
        </Link>
        <SaveButton jobId={job.id} saved={saved} />
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent text-sm hover:underline"
        >
          Original listing ↗
        </a>
      </div>
    </article>
  );
}
