'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveJobAction } from '@/app/actions';

/** "Save" → "Saved ✓ · My jobs". Saving only adds the job to your list; it never applies. */
export function SaveButton({ jobId, saved: initiallySaved }: { jobId: string; saved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (saved) {
    return (
      <span className="text-good inline-flex items-center gap-2 text-sm font-medium">
        ✓ Saved
        <Link href="/tracker" className="text-accent font-normal hover:underline">
          My jobs
        </Link>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveJobAction(jobId);
            if (result.ok) setSaved(true);
            else setError(result.error);
          })
        }
        className="border-border bg-surface hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {error && (
        <span role="alert" className="text-bad text-sm">
          {error}
        </span>
      )}
    </span>
  );
}
