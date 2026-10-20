import { Callout } from './ui';

/** Shown instead of a page when the app can't reach its database. */
export function SetupProblem({ error }: { error: string }) {
  return (
    <div className="space-y-4">
      <Callout tone="bad" title="Remote Radar can’t reach its database">
        <p>
          The app keeps your saved jobs in a small database on your computer, and it isn’t running
          right now.
        </p>
      </Callout>
      <div className="bg-surface border-border rounded-xl border p-5 text-sm leading-relaxed">
        <p className="font-medium">To fix it</p>
        <ol className="text-muted mt-2 list-decimal space-y-1 pl-5">
          <li>Start Docker Desktop.</li>
          <li>
            In the project folder, run{' '}
            <code className="bg-surface-muted rounded px-1.5 py-0.5">npm run db:up</code>.
          </li>
          <li>Reload this page.</li>
        </ol>
        <details className="mt-4">
          <summary className="text-muted cursor-pointer">Technical details</summary>
          <pre className="bg-surface-muted mt-2 overflow-x-auto rounded p-3 text-xs whitespace-pre-wrap">
            {error}
          </pre>
        </details>
      </div>
    </div>
  );
}
