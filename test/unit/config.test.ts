import { describe, expect, it } from 'vitest';
import { DEFAULT_DATABASE_URL, loadConfig } from '../../src/config.js';
import { formatNoteEntry } from '../../src/domain/application.js';

describe('loadConfig', () => {
  it('defaults to the docker-compose database', () => {
    expect(loadConfig({})).toEqual({ databaseUrl: DEFAULT_DATABASE_URL, logLevel: 'info' });
  });

  it('reads DATABASE_URL and LOG_LEVEL', () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@db:5432/x', LOG_LEVEL: 'debug' });
    expect(config).toEqual({ databaseUrl: 'postgresql://u:p@db:5432/x', logLevel: 'debug' });
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});

describe('formatNoteEntry', () => {
  it('prefixes the note with the date and status', () => {
    expect(formatNoteEntry('applied', '  Sent CV ', new Date('2026-10-21T23:30:00Z'))).toBe(
      '[2026-10-21 applied] Sent CV',
    );
  });
});
