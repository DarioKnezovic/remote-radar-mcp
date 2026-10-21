import { expect, test } from '@playwright/test';
import { resetDemoData, useExampleProfile } from './env';

test.beforeEach(async () => {
  await resetDemoData();
  await useExampleProfile();
});

test('a role posted once per country shows once, with links to the other countries', async ({
  page,
}) => {
  await page.goto('/jobs?where=all');
  const card = page.getByRole('article').filter({ hasText: 'Harbor Metrics' });

  // The Spain, Canada and Serbia listings are one job. The example profile lives in Serbia,
  // so its copy is shown, though it's the oldest.
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('📍 Remote, Serbia');
  await expect(card).toContainText('Also posted for Remote, Canada and Remote, Spain');

  await card.getByRole('heading', { name: 'Platform Engineer' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Platform Engineer' })).toBeVisible();
  await expect(page.getByText('Listing says: “Remote, Serbia”')).toBeVisible();
  await expect(page.getByText('Apply through the one for where you live')).toBeVisible();

  await page.getByRole('link', { name: 'Remote, Canada' }).click();
  await expect(page).toHaveURL(/harbor-platform-canada/);
  await expect(page.getByText('Listing says: “Remote, Canada”')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Remote, Spain' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Remote, Serbia' })).toBeVisible();
});
