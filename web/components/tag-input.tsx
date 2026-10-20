'use client';

import { useId, useState, type KeyboardEvent } from 'react';

/**
 * A list of short values shown as removable chips. Type and press Enter (or a comma) to
 * add; suggestions appear as you type. `normalize` can turn "node" into "Node.js".
 */
export function TagInput({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  normalize = (value) => value,
  placeholder,
  max = 50,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: readonly string[];
  normalize?: (value: string) => string;
  placeholder?: string;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const value = normalize(raw.trim()).slice(0, 80);
    setDraft('');
    if (!value || values.length >= max) return;
    const exists = values.some((v) => v.toLowerCase() === value.toLowerCase());
    if (!exists) onChange([...values, value]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  const available = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-muted text-sm">{hint}</p>}
      <div className="bg-surface border-border focus-within:border-accent mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
        {values.map((value) => (
          <span
            key={value}
            className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Remove ${value}`}
              className="hover:bg-accent/15 rounded-full px-1.5 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          list={available.length > 0 ? `${id}-list` : undefined}
          onChange={(event) => {
            // Picking a suggestion replaces the text at once: add it. Typing ("Go" on the way
            // to "Google Cloud") reports "insertText" and must not.
            const value = event.target.value;
            const { inputType } = event.nativeEvent as InputEvent;
            const picked = inputType === 'insertReplacementText' || inputType === undefined;
            if (picked && available.includes(value)) add(value);
            else setDraft(value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={values.length === 0 ? placeholder : 'Add more…'}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
        {available.length > 0 && (
          <datalist id={`${id}-list`}>
            {available.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  );
}
