'use client';

import { useState, useTransition } from 'react';
import { APPLICATION_STATUSES, type ApplicationStatus } from 'remote-radar-mcp/domain';
import { addNoteAction, updateStatusAction, type ActionResult } from '@/app/actions';
import { STATUS_LABELS } from '@/lib/labels';

/** Moving a saved job between stages, and adding notes. Applying itself happens elsewhere. */
export function StatusControls({ jobId, status }: { jobId: string; status: ApplicationStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  // Shows the chosen status right away; the parent remounts this (key) with the saved one.
  const [value, setValue] = useState(status);

  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone?.();
      } else {
        setValue(status);
        setError(result.error);
      }
    });
  }

  function move(next: ApplicationStatus) {
    setValue(next);
    run(() => updateStatusAction(jobId, next));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value === 'found' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => move('applied')}
            title="Only after you’ve applied on the company’s site"
            className="bg-accent rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
          >
            I applied
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Status</span>
          <select
            value={value}
            disabled={pending}
            onChange={(event) => move(event.target.value as ApplicationStatus)}
            className="bg-surface border-border rounded-lg border px-2 py-1.5 text-sm"
          >
            {APPLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setNoteOpen((open) => !open)}
          className="text-accent text-sm hover:underline"
          aria-expanded={noteOpen}
        >
          {noteOpen ? 'Cancel note' : 'Add a note'}
        </button>
        {pending && <span className="text-muted text-sm">Saving…</span>}
      </div>

      {noteOpen && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => addNoteAction(jobId, note),
              () => {
                setNote('');
                setNoteOpen(false);
              },
            );
          }}
          className="space-y-2"
        >
          <label className="block">
            <span className="sr-only">Note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="e.g. Sent my CV through their site. Recruiter: Ana."
              className="bg-surface border-border w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending || note.trim().length === 0}
            className="border-border bg-surface hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Save note
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-bad text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
