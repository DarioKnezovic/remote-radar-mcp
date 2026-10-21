import { describe, expect, it } from 'vitest';
import { paysAtLeast, parseSalary, toYearly } from '../../src/domain/salary.js';

describe('parseSalary', () => {
  it.each([
    // Ashby summaries, with extras after "•" ignored (the "20%" isn't an amount)
    ['$147K – $238K • Offers Equity • Multiple Ranges', 147_000, 238_000, 'USD', 'year'],
    ['€89.7K – €152.3K • Offers Equity • Plus up to 20% bonus', 89_700, 152_300, 'EUR', 'year'],
    ['CA$162K – CA$200K • Offers Equity', 162_000, 200_000, 'CAD', 'year'],
    ['£90K – £135K', 90_000, 135_000, 'GBP', 'year'],
    ['PLN 270,895 – PLN 366,505', 270_895, 366_505, 'PLN', 'year'],
    ['€107,567.50 – €132,877.50', 107_567.5, 132_877.5, 'EUR', 'year'],
    ['€2,800 – €3,285 per month', 2_800, 3_285, 'EUR', 'month'],
    // formatSalaryRange output (Remote OK, Lever)
    ['USD 50,000–70,000 per year', 50_000, 70_000, 'USD', 'year'],
    ['USD 10,000 per year', 10_000, 10_000, 'USD', 'year'],
    // Remotive free text
    ['$170k - $200k', 170_000, 200_000, 'USD', 'year'],
    ['$35,3k- $52k', 35_300, 52_000, 'USD', 'year'],
    ['OTE $25k - $35k', 25_000, 35_000, 'USD', 'year'],
    ['$50-$75 /hour', 50, 75, 'USD', 'hour'],
    ['€500–650 per day', 500, 650, 'EUR', 'day'],
    ['USD 40–55 an hour', 40, 55, 'USD', 'hour'],
  ])('reads %s', (text, min, max, currency, period) => {
    expect(parseSalary(text)).toEqual({ min, max, currency, period });
  });

  it('reads open-ended ranges', () => {
    expect(parseSalary('from €60,000 per year')).toMatchObject({ min: 60_000, max: null });
    expect(parseSalary('$120k+')).toMatchObject({ min: 120_000, max: null });
    expect(parseSalary('up to $90k')).toMatchObject({ min: null, max: 90_000 });
  });

  it.each([
    [null],
    [''],
    ['Competitive'],
    ['$1000 per task'],
    // A "yearly" salary this low is a data error; guessing would hide or show the wrong jobs.
    ['USD 30–36 per year'],
    // No period and too small to be yearly
    ['$50-$75'],
    // Unknown currency
    ['SEK 600,000 per year'],
    ['100,000 per year'],
  ])('returns null for %s', (text) => {
    expect(parseSalary(text)).toBeNull();
  });
});

describe('toYearly', () => {
  it('turns rates into full-time yearly pay', () => {
    expect(toYearly({ min: 50, max: 75, currency: 'USD', period: 'hour' }, 'USD')).toEqual({
      min: 104_000,
      max: 156_000,
    });
    expect(toYearly({ min: 500, max: null, currency: 'EUR', period: 'day' }, 'EUR')).toEqual({
      min: 115_000,
      max: null,
    });
  });

  it('converts currencies with the approximate rates', () => {
    const { max } = toYearly({ min: null, max: 100_000, currency: 'EUR', period: 'year' }, 'USD');
    expect(max).toBeCloseTo(112_250);
  });
});

describe('paysAtLeast', () => {
  const minimum = { amount: 100_000, currency: 'EUR' } as const;

  it('keeps jobs whose range reaches the minimum', () => {
    expect(paysAtLeast({ salary: '€90K – €120K' }, minimum)).toBe(true);
    expect(paysAtLeast({ salary: '$100k - $130k' }, minimum)).toBe(true); // ≈ €116k at the top
    expect(paysAtLeast({ salary: '€500–650 per day' }, minimum)).toBe(true); // €149.5k a year
  });

  it('hides jobs whose whole range is below it', () => {
    expect(paysAtLeast({ salary: '€70,000–90,000 per year' }, minimum)).toBe(false);
    expect(paysAtLeast({ salary: '$100k' }, minimum)).toBe(false); // ≈ €89k
    expect(paysAtLeast({ salary: 'up to €95k' }, minimum)).toBe(false);
  });

  it('keeps jobs without a readable salary, and "from X"', () => {
    expect(paysAtLeast({ salary: null }, minimum)).toBe(true);
    expect(paysAtLeast({ salary: 'Competitive' }, minimum)).toBe(true);
    expect(paysAtLeast({ salary: 'from €60,000 per year' }, minimum)).toBe(true);
  });
});
