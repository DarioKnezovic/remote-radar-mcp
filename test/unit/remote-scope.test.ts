import { describe, expect, it } from 'vitest';
import { classifyRemoteScope, detectRegions } from '../../src/domain/remote-scope.js';

describe('classifyRemoteScope', () => {
  it.each([
    ['Worldwide', 'Worldwide'],
    ['Anywhere in the world', 'Worldwide'],
    ['Worldwide (CET preferred)', 'Worldwide'],
    ['Europe', 'Europe'],
    ['Germany, Austria, Switzerland', 'Europe'],
    ['CET +/- 2h', 'Europe'],
    ['UK, EU', 'Europe'],
    ['EU', 'EU only'],
    ['European Union', 'EU only'],
    ['USA', 'US only'],
    ['United States', 'US only'],
    ['U.S. only', 'US only'],
    ['USA, Canada, USA timezones', 'Americas'],
    ['LATAM', 'Americas'],
    ['Europe, USA, Canada, APAC', 'Multi-region'],
    ['EMEA', 'Multi-region'],
    ['APAC', 'Other'],
    ['Mars', 'Other'],
    ['', 'Unknown'],
    [null, 'Unknown'],
  ] as const)('%j → %s', (location, expected) => {
    expect(classifyRemoteScope(location)).toBe(expected);
  });

  it('does not mistake ordinary lowercase words for US/EU', () => {
    expect(detectRegions('join us from anywhere in europe')).toEqual(
      new Set(['worldwide', 'europe']),
    );
  });
});
