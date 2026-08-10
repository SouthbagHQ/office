import { expect, test } from '@playwright/test';

test('creates and edits files across the suite', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.locator('.office-app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your work is around here' })).toBeVisible();
  await expect(page.getByRole('button', { name: /New document/ })).toBeVisible();

  await page.getByRole('button', { name: /New document/ }).click();
  if (errors.length) throw new Error(`Browser console: ${errors.join(' | ')}`);
  await expect(page.getByRole('textbox', { name: 'Document title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Document title' }).fill('Browser verified memorandum');
  await page.getByRole('button', { name: 'Back to files' }).click();

  await page.getByRole('button', { name: /New presentation/ }).click();
  await expect(page.getByRole('textbox', { name: 'Presentation title' })).toBeVisible();
  await page.getByRole('button', { name: /New slide/ }).click();
  await expect(page.getByText('SLIDE 2 OF 2')).toBeVisible();
  await page.getByRole('button', { name: 'Back to files' }).click();

  await page.getByRole('button', { name: /New spreadsheet/ }).click();
  await expect(page.getByRole('textbox', { name: 'Spreadsheet title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Formula bar' }).fill('=2+3');
  await expect(page.getByRole('textbox', { name: 'Formula bar' })).toHaveValue('=2+3');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Browser verified memorandum')).toBeVisible();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  const cloud = await page.request.get('/api/workspace');
  expect(cloud.ok()).toBeTruthy();
  expect(((await cloud.json()) as { revision: number }).revision).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('renders the intentionally unhelpful home at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your work is around here' })).toBeVisible();
  await expect(page.getByRole('button', { name: /New document/ })).toBeVisible();
});
