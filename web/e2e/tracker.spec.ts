import { expect, test, type Page } from '@playwright/test';
import { resetDemoData, useExampleProfile } from './env';

/** A column on My jobs, e.g. "Saved" or "Applied". */
const column = (page: Page, label: string) =>
  page.getByRole('region', { name: new RegExp(`^${label}\\s*\\d+$`) });

test.beforeEach(async () => {
  await resetDemoData();
  await useExampleProfile();
});

test('saving a job from Find jobs adds it to My jobs', async ({ page }) => {
  await page.goto('/jobs?q=Pebble&where=all');
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Part-time React Developer' }) });

  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText('✓ Saved')).toBeVisible();

  await card.getByRole('link', { name: 'My jobs' }).click();
  await expect(page).toHaveURL(/\/tracker$/);
  await expect(
    column(page, 'Saved').getByRole('link', { name: 'Part-time React Developer' }),
  ).toBeVisible();
});

test('"I applied" moves a job to Applied, and notes show on the card and job page', async ({
  page,
}) => {
  const title = 'Full-Stack Engineer (Node.js / React)';
  await page.goto('/tracker');
  const card = page.getByRole('article').filter({ hasText: title });

  await column(page, 'Saved')
    .getByRole('article')
    .filter({ hasText: title })
    .getByRole('button', { name: 'I applied' })
    .click();
  await expect(column(page, 'Applied').getByRole('link', { name: title })).toBeVisible();
  await expect(column(page, 'Saved').getByRole('link', { name: title })).toHaveCount(0);

  await card.getByRole('button', { name: 'Add a note' }).click();
  await card.getByRole('textbox', { name: 'Note' }).fill('Sent my CV. Recruiter: Ana.');
  await card.getByRole('button', { name: 'Save note' }).click();
  await expect(card.getByText('Sent my CV. Recruiter: Ana.')).toBeVisible();

  await card.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: 'In My jobs: Applied' })).toBeVisible();
  await expect(page.getByText('Sent my CV. Recruiter: Ana.')).toBeVisible();
  await page.getByText('History').click();
  await expect(page.getByText('Saved → Applied')).toBeVisible();
});
