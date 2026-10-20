import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, foldText, htmlToText, truncate } from '../../src/domain/text.js';
import {
  formatSalaryRange,
  normalizeTags,
  splitTitle,
  textOrNull,
  toIsoUtc,
} from '../../src/sources/normalize-helpers.js';

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

describe('formatSalaryRange', () => {
  it.each([
    [
      { min: 140000, max: 250000, currency: 'usd', interval: 'per-year' },
      'USD 140,000–250,000 per year',
    ],
    [
      { min: 193461, max: 291000, currency: 'USD', interval: 'per-year-salary' },
      'USD 193,461–291,000 per year',
    ],
    [{ min: 50, max: 50, currency: 'EUR', interval: 'per-hour-wage' }, 'EUR 50 per hour'],
    [{ min: 60000, max: 0, currency: 'EUR' }, 'EUR from 60,000'],
    [{ max: 90000 }, 'up to 90,000'],
    [{ min: 0, max: 0, currency: 'USD' }, null],
  ] as const)('%j → %s', (input, expected) => {
    expect(formatSalaryRange(input)).toBe(expected);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes entities but keeps tags', () => {
    expect(decodeHtmlEntities('&lt;p&gt;R&amp;D&lt;/p&gt;')).toBe('<p>R&D</p>');
  });
});

describe('splitTitle', () => {
  it.each([
    ['Staff PM, Platform |  Germany | Remote', 'Staff PM, Platform', 'Germany, Remote'],
    ['Engineering Manager | Remote | Europe', 'Engineering Manager', 'Remote, Europe'],
    ['Backend Engineer | Payments', 'Backend Engineer | Payments', null],
    ['Plain title', 'Plain title', null],
  ])('%j → %j + %j', (input, title, extra) => {
    expect(splitTitle(input)).toEqual({ title, extra });
  });
});
