import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PROFILE_FILE, useNoProfile } from './env';

test('a first-time user sets up a profile in three steps', async ({ page }) => {
  await useNoProfile();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Set up your profile' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Next →' });

  // 1. Where you live. The time zone defaults to the browser's.
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: /^Country/ }).selectOption({ label: 'Croatia' });
  await page.getByLabel('Add a citizenship').selectOption({ label: 'Croatia' });
  await expect(page.getByLabel('Time zone')).toHaveValue('Europe/Zagreb');
  await next.click();

  // 2. Skills: common spellings become the canonical name.
  const strong = page.getByLabel('Strong: you use these every day');
  await strong.fill('node');
  await strong.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Node.js' })).toBeVisible();
  await page.getByLabel('Years of professional experience').fill('6');
  await next.click();

  // 3. What you're looking for.
  const languages = page.getByLabel('Languages you can work in');
  await languages.fill('English');
  await languages.press('Enter');
  await page.getByRole('button', { name: 'Save my profile' }).click();

  await expect(page.getByRole('heading', { name: '✓ Your profile is ready' })).toBeVisible();
  const saved = JSON.parse(await readFile(PROFILE_FILE, 'utf8')) as Record<string, unknown>;
  expect(saved).toMatchObject({
    location: { country: 'Croatia', country_code: 'HR', timezone: 'Europe/Zagreb' },
    citizenship: ['HR'],
    years_experience: 6,
    skills: { strong: ['Node.js'] },
    languages: ['English'],
    looking_for: { employment_types: ['full_time'] },
  });

  await page.getByRole('link', { name: 'Find jobs that fit me →' }).click();
  await expect(page.getByText('Set up your profile to see which jobs fit you')).toHaveCount(0);
});
