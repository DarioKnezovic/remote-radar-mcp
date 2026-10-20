import { describe, expect, it } from 'vitest';
import { foldText, htmlToText, truncate } from '../../src/domain/text.js';
import { normalizeTags, textOrNull, toIsoUtc } from '../../src/sources/normalize-helpers.js';

describe('htmlToText', () => {
  it('turns block elements into line breaks and strips other tags', () => {
    expect(
      htmlToText('<h2>Role</h2><p>Build <b>React</b> apps.</p><ul><li>TS</li><li>Node</li></ul>'),
    ).toBe('Role\nBuild React apps.\nTS\nNode');
  });

  it('decodes named, decimal and hex entities', () => {
    expect(htmlToText('R&amp;D &lt;3 &#8364;50k &#x2014; caf&eacute;')).toBe(
      'R&D <3 €50k — caf&eacute;',
    );
  });

  it('drops script and style contents', () => {
    expect(htmlToText('<style>p{color:red}</style><p>Hi</p><script>alert(1)</script>')).toBe('Hi');
  });

  it('collapses whitespace including non-breaking spaces', () => {
    expect(htmlToText('<p>a&nbsp;&nbsp;  b</p>\n\n\n<p>c</p>')).toBe('a b\nc');
  });
});

describe('foldText', () => {
  it('lowercases and strips diacritics', () => {
    expect(foldText('Zürich Knezović ÉCOLE')).toBe('zurich knezovic ecole');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('cuts on a word boundary and adds an ellipsis', () => {
    expect(truncate('one two three four', 15)).toBe('one two three…');
  });

  it('cuts mid-word when there is no reasonable boundary', () => {
    expect(truncate('supercalifragilistic', 8)).toBe('superca…');
  });
});

describe('toIsoUtc', () => {
  it.each([
    ['2026-10-17T16:04:29', '2026-10-17T16:04:29.000Z'],
    ['2026-10-17T16:04:29Z', '2026-10-17T16:04:29.000Z'],
    ['2026-10-17T18:04:29+02:00', '2026-10-17T16:04:29.000Z'],
    [1792508457, '2026-10-20T15:00:57.000Z'],
  ] as const)('%j → %s', (input, expected) => {
    expect(toIsoUtc(input)).toBe(expected);
  });

  it('throws on invalid dates', () => {
    expect(() => toIsoUtc('yesterday')).toThrow(/Invalid date/);
  });
});

describe('textOrNull / normalizeTags', () => {
  it('maps blank values to null', () => {
    expect([textOrNull('  x '), textOrNull('  '), textOrNull(null), textOrNull(undefined)]).toEqual(
      ['x', null, null, null],
    );
  });

  it('dedupes tags case-insensitively, keeping the first spelling', () => {
    expect(normalizeTags(['React', ' react', '', 'Node.js'])).toEqual(['React', 'Node.js']);
  });
});
