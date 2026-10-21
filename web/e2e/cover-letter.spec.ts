import { expect, test } from '@playwright/test';
import { resetDemoData, useExampleProfile } from './env';

test.beforeEach(async () => {
  await resetDemoData();
  await useExampleProfile();
});

test('editing and saving a cover letter draft keeps it on the job page', async ({ page }) => {
  await page.goto('/jobs?q=Kestrel&where=all');
  await page.getByRole('link', { name: 'Senior Software Engineer, Frontend' }).click();

  await page.getByText('✍️ Cover letter draft').click();
  const letter = page.getByRole('textbox', { name: 'Cover letter' });
  await expect(letter).toHaveValue(/Dear Kestrel Analytics team,/);

  const edited = 'Dear Kestrel team,\n\nI build fast React apps for analytics products.';
  await letter.fill(edited);
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status')).toHaveText('Draft saved.');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();

  // The saved draft comes back after a reload, with the section already open.
  await page.reload();
  await expect(page.getByText(/^saved /)).toBeVisible();
  await expect(letter).toHaveValue(edited);

  // "Start over" asks once before replacing edits with a fresh draft from the profile.
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Click again to replace your edits' }).click();
  await expect(letter).toHaveValue(/Dear Kestrel Analytics team,/);
  await expect(page.getByText('unsaved changes')).toBeVisible();
});
