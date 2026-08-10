import { expect, test, type BrowserContext, type Page } from '@playwright/test';

function newIdentity(prefix = 'e2e') {
  return `${prefix}-${crypto.randomUUID()}@southbag.cc`;
}

async function signIn(page: Page, identity = newIdentity()) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  const logo = page.getByRole('img', { name: 'Southbag' });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(1000);
  await page.getByRole('link', { name: /Continue with Southbag Identity/ }).click();
  await expect(page).toHaveURL(/\/dev-idp\/authorize/);
  await page.getByRole('textbox', { name: 'Work email' }).fill(identity);
  await page.getByRole('textbox', { name: 'Name' }).fill('New Employee');
  await page.getByRole('textbox', { name: 'Password' }).fill('southbag');
  await page.getByRole('button', { name: 'Authorise Office' }).click();
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await expect(page.locator('.office-app')).toHaveAttribute('data-ready', 'true');
  return identity;
}

async function openSecondPage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.office-app')).toHaveAttribute('data-ready', 'true');
  return page;
}

async function createFromHome(page: Page, label: 'document' | 'presentation' | 'spreadsheet') {
  await page.getByRole('button', { name: new RegExp(`New ${label}`) }).click();
  const dialog = page.getByRole('dialog', { name: `Create new ${label}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Create' }).click();
}

test('creates and edits files across the suite', async ({ page }) => {
  const errors: string[] = [];
  const nativeDialogs: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('dialog', (dialog) => {
    nativeDialogs.push(dialog.type());
    void dialog.dismiss();
  });

  const unauthorized = await page.request.get('/api/workspace');
  expect(unauthorized.status()).toBe(401);
  await signIn(page);
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  await expect(page.getByText('No files')).toBeVisible();
  expect((await (await page.request.get('/api/workspace')).json()).workspace.files).toEqual([]);
  await expect(page.getByRole('button', { name: /New document/ })).toBeVisible();
  await page.locator('.waffle').click();
  await expect(page.getByRole('dialog', { name: 'Southbag Office' })).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();

  const openingDocument = page.getByText('Opening document…');
  await page.getByRole('button', { name: /New document/ }).click();
  await expect(page.getByRole('dialog', { name: 'Create new document?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('No files')).toBeVisible();
  await createFromHome(page, 'document');
  await expect(openingDocument).toBeVisible();
  if (errors.length) throw new Error(`Browser console: ${errors.join(' | ')}`);
  await expect(page.getByRole('textbox', { name: 'Document title' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('');
  await page.getByRole('textbox', { name: 'Document title' }).fill('Browser verified memorandum');
  await page.getByRole('textbox', { name: 'Document body' }).pressSequentially('Cloud memo body', { delay: 10 });
  await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Cloud memo body');
  await page.getByRole('button', { name: 'Back to files' }).click();

  await createFromHome(page, 'presentation');
  await expect(page.getByRole('textbox', { name: 'Presentation title' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('');
  await expect(page.getByRole('textbox', { name: 'Slide body' })).toHaveText('');
  await expect(page.locator('.speaker-notes textarea')).toHaveValue('');
  await page.getByRole('textbox', { name: 'Slide title' }).pressSequentially('A real slide', { delay: 10 });
  await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('A real slide');
  await page.getByRole('button', { name: 'Present ▶', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Presentation mode' })).toBeVisible();
  await page.getByRole('button', { name: /Exit presentation/ }).click();
  await page.getByRole('button', { name: /New slide/ }).click();
  await expect(page.getByText('SLIDE 2 OF 2')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('');
  await page.getByRole('button', { name: 'Back to files' }).click();

  await createFromHome(page, 'spreadsheet');
  await expect(page.getByRole('textbox', { name: 'Spreadsheet title' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Cell A1', exact: true })).toHaveValue('');
  await expect(page.locator('.chart-panel')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Cell A1', exact: true }).pressSequentially('Revenue', { delay: 10 });
  await expect(page.getByRole('textbox', { name: 'Cell A1', exact: true })).toHaveValue('Revenue');
  await page.getByRole('textbox', { name: 'Cell B2', exact: true }).click();
  await page.getByRole('textbox', { name: 'Formula bar' }).pressSequentially('=2+3', { delay: 10 });
  await expect(page.getByRole('textbox', { name: 'Formula bar' })).toHaveValue('=2+3');
  await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toHaveValue('5');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  await page.getByRole('textbox', { name: 'Search files' }).fill('memorandum');
  await expect(page.getByRole('alert')).toHaveText('Nothing found');
  await expect(page.getByRole('button', { name: 'Open Browser verified memorandum' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Untitled presentation' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search files' }).fill('');
  await expect(page.getByRole('button', { name: 'Open Browser verified memorandum' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Browser verified memorandum').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  await page.getByRole('button', { name: 'Open Browser verified memorandum' }).click();
  await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Cloud memo body');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await page.getByRole('button', { name: 'Open Untitled presentation' }).click();
  await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('A real slide');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await page.getByRole('button', { name: 'Open Untitled spreadsheet' }).click();
  await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toHaveValue('5');
  await page.getByRole('button', { name: 'Back to files' }).click();

  await page.getByRole('button', { name: 'Actions for Browser verified memorandum' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Deleting file…')).toBeHidden();
  await expect(page.getByText('Browser verified memorandum')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Browser verified memorandum')).toHaveCount(0);

  const deleteAll = page.getByRole('button', { name: 'Delete all files' });
  await expect(deleteAll).toBeEnabled();
  await deleteAll.click();
  await expect(page.getByText('Deleting all files…')).toBeHidden();
  await expect(page.getByText('No files')).toBeVisible();
  await expect(deleteAll).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText('No files')).toBeVisible();

  const cloud = await page.request.get('/api/workspace');
  expect(cloud.ok()).toBeTruthy();
  const cloudBody = (await cloud.json()) as { workspace: { files: unknown[] }; revision: number };
  expect(cloudBody.workspace.files).toEqual([]);
  expect(cloudBody.revision).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(nativeDialogs).toEqual([]);
});

test('requires authentication, rejects bad development credentials, and isolates accounts', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const first = await firstContext.newPage();
  const errors: string[] = [];
  first.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const firstIdentity = newIdentity('isolation-a');

  await first.goto('/');
  await expect(first).toHaveURL(/\/login$/);
  await first.getByRole('link', { name: /Continue with Southbag Identity/ }).click();
  await first.getByRole('textbox', { name: 'Work email' }).fill(firstIdentity);
  await first.getByRole('textbox', { name: 'Name' }).fill('Account A');
  await first.getByRole('textbox', { name: 'Password' }).fill('wrong');
  await first.getByRole('button', { name: 'Authorise Office' }).click();
  await expect(first.getByText(/development identity disagrees/i)).toBeVisible();
  errors.length = 0;
  await first.getByRole('textbox', { name: 'Password' }).fill('southbag');
  await first.getByRole('button', { name: 'Authorise Office' }).click();
  await expect(first.locator('.office-app')).toHaveAttribute('data-ready', 'true');

  await createFromHome(first, 'document');
  await first.getByRole('textbox', { name: 'Document title' }).fill('Private to account A');
  await first.getByRole('button', { name: 'Back to files' }).click();
  await expect(first.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await signIn(second, newIdentity('isolation-b'));
  await expect(second.getByText('No files')).toBeVisible();
  await expect(second.getByText('Private to account A')).toHaveCount(0);

  await first.locator('.account-button').click();
  await first.getByRole('link', { name: /sign out/i }).click();
  await expect(first).toHaveURL(/\/login$/);
  expect((await first.request.get('/api/workspace')).status()).toBe(401);
  expect(errors).toEqual([]);

  await secondContext.close();
  await firstContext.close();
});

test('keeps a deletion when an older tab later saves', async ({ page, context }) => {
  await signIn(page, newIdentity('conflict'));
  await createFromHome(page, 'document');
  await page.getByRole('textbox', { name: 'Document title' }).fill('Delete me in tab one');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  const olderTab = await openSecondPage(context);
  await olderTab.getByRole('button', { name: 'Open Delete me in tab one' }).click();

  await page.getByRole('button', { name: 'Actions for Delete me in tab one' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();

  await olderTab.getByRole('textbox', { name: 'Document title' }).fill('Older tab tried to restore me');
  await expect(olderTab.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  await olderTab.reload();
  await expect(olderTab.getByText('No files')).toBeVisible();
  await expect(olderTab.getByText('Older tab tried to restore me')).toHaveCount(0);
});

test('creates a document when randomUUID is unavailable on an HTTP origin', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { configurable: true, value: undefined });
  });
  await signIn(page, newIdentity('insecure-origin'));
  await createFromHome(page, 'document');
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Untitled document');
  await page.getByRole('textbox', { name: 'Document body' }).pressSequentially('Created over HTTP');
  await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Created over HTTP');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  const cloud = await page.request.get('/api/workspace');
  expect(((await cloud.json()) as { workspace: { files: unknown[] } }).workspace.files).toHaveLength(1);
});

test('exports and imports a server-encrypted Southbag file', async ({ page }) => {
  await signIn(page, newIdentity('encrypted-format'));
  const file = {
    id: 'doc-format-round-trip',
    kind: 'doc',
    title: 'Confidential format test',
    content: '<p>Only the configured server should read this.</p>',
    modified: new Date().toISOString(),
    owner: 'Format Tester'
  };

  const exported = await page.request.post('/api/files/export', { data: { file } });
  expect(exported.ok()).toBeTruthy();
  expect(exported.headers()['content-type']).toBe('application/vnd.southbag.docs');
  expect(exported.headers()['content-disposition']).toContain('Confidential format test.southbagdocs');
  const encrypted = await exported.body();
  expect(encrypted.subarray(0, 8).toString()).toBe('SOUTHBAG');
  expect(encrypted.toString()).not.toContain('Only the configured server');

  const imported = await page.request.post('/api/files/import', {
    data: encrypted,
    headers: { 'content-type': 'application/vnd.southbag.docs' }
  });
  expect(imported.ok()).toBeTruthy();
  expect((await imported.json()).file).toEqual(file);
});

test('renders the intentionally unhelpful home at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByText('No files')).toBeVisible();
  await expect(page.getByRole('button', { name: /New document/ })).toBeVisible();
});
