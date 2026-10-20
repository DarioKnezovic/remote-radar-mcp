'use client';

import { useState, useTransition } from 'react';
import { saveCoverLetterAction } from '@/app/actions';

type Notice = { tone: 'good' | 'bad' | 'muted'; text: string } | undefined;

const PLACEHOLDER = /\[[^\]\n]{3,}\]/;

const buttonClass =
  'border-border bg-surface hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50';

/**
 * An editable cover letter draft. Copy it, save your edits, or copy a prompt to polish it
 * with Claude. Nothing is sent anywhere: you paste it yourself.
 */
export function CoverLetterEditor({
  jobId,
  generated,
  saved,
  promptIntro,
}: {
  jobId: string;
  /** A fresh draft from the profile, used when nothing is saved and for "Start over". */
  generated: string;
  saved: { body: string; updated_at: string } | undefined;
  /** Everything Claude needs, ending where the current draft is appended. */
  promptIntro: string;
}) {
  const [text, setText] = useState(saved?.body ?? generated);
  const [savedText, setSavedText] = useState<string | null>(saved?.body ?? null);
  const [notice, setNotice] = useState<Notice>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const unsaved = text !== (savedText ?? generated);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ tone: 'good', text: done });
    } catch {
      setNotice({
        tone: 'bad',
        text: 'Couldn’t copy. Select the text and press Ctrl+C (⌘C on a Mac).',
      });
    }
  }

  function save() {
    startTransition(async () => {
      const result = await saveCoverLetterAction(jobId, text);
      if (!result.ok) {
        setNotice({ tone: 'bad', text: result.error });
        return;
      }
      setSavedText(result.updatedAt ? text : null);
      setNotice({ tone: 'good', text: result.updatedAt ? 'Draft saved.' : 'Draft deleted.' });
    });
  }

  function startOver() {
    if (text !== generated && !confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setText(generated);
    setNotice({ tone: 'muted', text: 'New draft from your profile. Save it to keep it.' });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Cover letter</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmReset(false);
            setNotice(undefined);
          }}
          rows={16}
          maxLength={20_000}
          spellCheck
          className="bg-surface border-border focus:border-accent block w-full rounded-lg border p-4 text-sm leading-relaxed focus:outline-none"
        />
      </label>

      <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {words} words{unsaved && ' · unsaved changes'}
        </span>
        {PLACEHOLDER.test(text) && (
          <span className="text-warn">Replace the [bracketed] parts before you send it.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy(text, 'Copied. Paste it into your application.')}
          className="bg-accent rounded-lg px-3 py-1.5 text-sm font-medium text-white dark:text-black"
        >
          Copy letter
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || (!unsaved && savedText !== null)}
          className={buttonClass}
        >
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" onClick={startOver} className={buttonClass}>
          {confirmReset ? 'Click again to replace your edits' : 'Start over'}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={`text-sm ${notice.tone === 'good' ? 'text-good' : notice.tone === 'bad' ? 'text-bad' : 'text-muted'}`}
        >
          {notice.text}
        </p>
      )}

      <div className="bg-surface-muted rounded-lg p-4 text-sm">
        <p className="font-medium">Polish it with Claude</p>
        <p className="text-muted mt-1 leading-relaxed">
          Copies a ready-made prompt with this listing, your profile and your current draft. Paste
          it into Claude yourself; nothing is sent from here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void copy(promptIntro + text, 'Prompt copied. Paste it into Claude.')}
            className={buttonClass}
          >
            Copy prompt for Claude
          </button>
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-sm hover:underline"
          >
            Open Claude ↗
          </a>
        </div>
      </div>
    </div>
  );
}
