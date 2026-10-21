import { expect, test } from '@playwright/test';
import { resetDemoData, useExampleProfile } from './env';

test.beforeEach(async () => {
  await resetDemoData();
  await useExampleProfile();
});

test('a minimum salary hides lower-paid jobs and keeps jobs without a salary', async ({ page }) => {
  await page.goto('/jobs?where=all');
  const results = page.getByRole('list').filter({ has: page.getByRole('article') });
  const title = (name: string) => results.getByRole('heading', { name });

  // The example profile lives in Serbia, so the currency defaults to EUR.
  await expect(page.getByLabel('Currency')).toHaveValue('EUR');
  await page.getByLabel('Amount').fill('100k');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/pay=100k&currency=EUR/);

  // €70,000–90,000 can't reach it; USD 110,000–140,000 (≈ €125k) and €500–650 a day can.
  await expect(title('Senior Frontend Engineer (React)')).toHaveCount(0);
  await expect(title('Frontend Lead')).toBeVisible();
  await expect(title('Staff Product Engineer')).toBeVisible();
  // No salary stated: still shown.
  await expect(title('Full-Stack Engineer (Node.js / React)')).toBeVisible();

  await page.getByLabel('Only jobs that state a salary').check();
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/paid=1/);
  await expect(title('Frontend Lead')).toBeVisible();
  await expect(title('Full-Stack Engineer (Node.js / React)')).toHaveCount(0);
});
