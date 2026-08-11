# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: office.spec.ts >> creates and edits files across the suite
- Location: tests/office.spec.ts:38:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Delete', exact: true })
    - locator resolved to <button>Delete</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    3 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 500ms
    94 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button class="cloud-status cloud-saved" title="Last cloud save 8/11/2026, 5:31:14 PM">…</button> intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=f3e3]:
  - button "Saved to cloud Southbag Identity workspace" [ref=f3e4] [cursor=pointer]:
    - strong [ref=f3e6]: Saved to cloud
    - generic [ref=f3e7]: Southbag Identity workspace
  - banner [ref=f3e8]:
    - button "Southbag Office home" [ref=f3e9] [cursor=pointer]:
      - img "Southbag" [ref=f3e10]
      - generic [ref=f3e11]:
        - strong [ref=f3e12]: Office™
        - generic [ref=f3e13]: WORK PRODUCT / PROBABLY
    - generic [ref=f3e14]:
      - generic [ref=f3e15]: ⌕
      - textbox "Search files" [ref=f3e16]
      - generic [ref=f3e17]: ⌘?
    - button "⠿" [ref=f3e18] [cursor=pointer]
    - button "N New Employee" [ref=f3e19]:
      - generic [ref=f3e20]: "N"
      - generic [ref=f3e21]: New Employee
  - generic [ref=f3e22]:
    - text: Signed in. Cloud storage connected.
    - button "×" [ref=f3e23]
  - generic [ref=f3e24]:
    - complementary [ref=f3e25]:
      - button "⌂ Files" [ref=f3e26] [cursor=pointer]:
        - generic [ref=f3e27]: ⌂
        - strong [ref=f3e28]: Files
      - generic [ref=f3e29]:
        - button "¶ Docs Write ↗" [ref=f3e30] [cursor=pointer]:
          - generic [ref=f3e31]: ¶
          - strong [ref=f3e32]: Docs
          - generic [ref=f3e33]: Write
          - text: ↗
        - button "▰ Slides Present ↗" [ref=f3e34] [cursor=pointer]:
          - generic [ref=f3e35]: ▰
          - strong [ref=f3e36]: Slides
          - generic [ref=f3e37]: Present
          - text: ↗
        - button "⌗ Sheets Calculate ↗" [ref=f3e38] [cursor=pointer]:
          - generic [ref=f3e39]: ⌗
          - strong [ref=f3e40]: Sheets
          - generic [ref=f3e41]: Calculate
          - text: ↗
      - button [ref=f3e43] [cursor=pointer]:
        - generic [ref=f3e45]:
          - strong [ref=f3e46]: Cloud storage
          - text: saved
      - button "Support" [ref=f3e47]
    - main [ref=f3e48]:
      - generic [ref=f3e49]:
        - generic "Create a file" [ref=f3e50]:
          - button "¶ New document Docs" [ref=f3e51] [cursor=pointer]:
            - generic [ref=f3e52]: ¶
            - strong [ref=f3e53]: New document
            - generic [ref=f3e54]: Docs
          - button "▱ New presentation Slides" [ref=f3e55] [cursor=pointer]:
            - generic [ref=f3e56]: ▱
            - strong [ref=f3e57]: New presentation
            - generic [ref=f3e58]: Slides
          - button "⌗ New spreadsheet Sheets" [ref=f3e59] [cursor=pointer]:
            - generic [ref=f3e60]: ⌗
            - strong [ref=f3e61]: New spreadsheet
            - generic [ref=f3e62]: Sheets
          - generic [ref=f3e63] [cursor=pointer]:
            - button "⇧ Import file Southbag format only"
            - generic [ref=f3e64]: ⇧
            - strong [ref=f3e65]: Import file
            - generic [ref=f3e66]: Southbag format only
        - generic [ref=f3e67]:
          - button "Delete all files" [ref=f3e68] [cursor=pointer]
          - button "Oldest first" [ref=f3e69] [cursor=pointer]: ↕
          - generic [ref=f3e70]: "3"
        - generic [ref=f3e71]:
          - article [ref=f3e72]:
            - button "Open Untitled spreadsheet" [ref=f3e73] [cursor=pointer]:
              - generic [ref=f3e102]:
                - strong [ref=f3e103]: Untitled spreadsheet
                - generic [ref=f3e104]: Sheets · Aug 11, 5:31 PM
            - button "Actions for Untitled spreadsheet" [ref=f3e105] [cursor=pointer]: •••
          - article [ref=f3e106]:
            - button "Open Untitled presentation" [ref=f3e107] [cursor=pointer]:
              - generic [ref=f3e113]:
                - strong [ref=f3e114]: Untitled presentation
                - generic [ref=f3e115]: Slides · Aug 11, 5:31 PM
            - button "Actions for Untitled presentation" [ref=f3e116] [cursor=pointer]: •••
          - article [ref=f3e117]:
            - button "Open Browser verified memorandum" [ref=f3e118] [cursor=pointer]:
              - generic [ref=f3e128]:
                - strong [ref=f3e129]: Browser verified memorandum
                - generic [ref=f3e130]: Docs · Aug 11, 5:31 PM
            - button "Actions for Browser verified memorandum" [expanded] [active] [ref=f3e131] [cursor=pointer]: •••
            - generic [ref=f3e132]:
              - button "Export document" [ref=f3e133] [cursor=pointer]
              - button "Delete" [ref=f3e134] [cursor=pointer]
```

# Test source

```ts
  33  |   const dialog = page.getByRole('dialog', { name: `Create new ${label}?` });
  34  |   await expect(dialog).toBeVisible();
  35  |   await dialog.getByRole('button', { name: 'Create' }).click();
  36  | }
  37  | 
  38  | test('creates and edits files across the suite', async ({ page }) => {
  39  |   const errors: string[] = [];
  40  |   const nativeDialogs: string[] = [];
  41  |   page.on('console', (message) => {
  42  |     if (message.type() === 'error') errors.push(message.text());
  43  |   });
  44  |   page.on('dialog', (dialog) => {
  45  |     nativeDialogs.push(dialog.type());
  46  |     void dialog.dismiss();
  47  |   });
  48  | 
  49  |   const unauthorized = await page.request.get('/api/workspace');
  50  |   expect(unauthorized.status()).toBe(401);
  51  |   await signIn(page);
  52  |   await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  53  |   await expect(page.getByText('No files')).toBeVisible();
  54  |   expect((await (await page.request.get('/api/workspace')).json()).workspace.files).toEqual([]);
  55  |   await expect(page.getByRole('button', { name: /New document/ })).toBeVisible();
  56  |   await page.locator('.waffle').click();
  57  |   await expect(page.getByRole('dialog', { name: 'Southbag Office' })).toBeVisible();
  58  |   await page.getByRole('button', { name: 'OK' }).click();
  59  | 
  60  |   const openingDocument = page.getByText('Opening document…');
  61  |   await page.getByRole('button', { name: /New document/ }).click();
  62  |   await expect(page.getByRole('dialog', { name: 'Create new document?' })).toBeVisible();
  63  |   await page.getByRole('button', { name: 'Cancel' }).click();
  64  |   await expect(page.getByText('No files')).toBeVisible();
  65  |   await createFromHome(page, 'document');
  66  |   await expect(openingDocument).toBeVisible();
  67  |   if (errors.length) throw new Error(`Browser console: ${errors.join(' | ')}`);
  68  |   await expect(page.getByRole('textbox', { name: 'Document title' })).toBeVisible();
  69  |   await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('');
  70  |   await page.getByRole('textbox', { name: 'Document title' }).fill('Browser verified memorandum');
  71  |   await page.getByRole('textbox', { name: 'Document body' }).pressSequentially('Cloud memo body', { delay: 10 });
  72  |   await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Cloud memo body');
  73  |   const egressEvents = await page.getByRole('textbox', { name: 'Document body' }).evaluate((element) => ({
  74  |     copyAllowed: element.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })),
  75  |     cutAllowed: element.dispatchEvent(new ClipboardEvent('cut', { bubbles: true, cancelable: true })),
  76  |     dragAllowed: element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })),
  77  |     pasteAllowed: document.body.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
  78  |   }));
  79  |   expect(egressEvents).toEqual({ copyAllowed: false, cutAllowed: false, dragAllowed: false, pasteAllowed: true });
  80  |   await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Cloud memo body');
  81  |   await page.getByRole('button', { name: 'Back to files' }).click();
  82  | 
  83  |   await createFromHome(page, 'presentation');
  84  |   await expect(page.getByRole('textbox', { name: 'Presentation title' })).toBeVisible();
  85  |   await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('');
  86  |   await expect(page.getByRole('textbox', { name: 'Slide body' })).toHaveText('');
  87  |   await expect(page.locator('.speaker-notes textarea')).toHaveValue('');
  88  |   await page.getByRole('textbox', { name: 'Slide title' }).pressSequentially('A real slide', { delay: 10 });
  89  |   await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('A real slide');
  90  |   await page.getByRole('button', { name: 'Present ▶', exact: true }).click();
  91  |   await expect(page.getByRole('dialog', { name: 'Presentation mode' })).toBeVisible();
  92  |   await page.getByRole('button', { name: /Exit presentation/ }).click();
  93  |   await page.getByRole('button', { name: /New slide/ }).click();
  94  |   await expect(page.getByText('SLIDE 2 OF 2')).toBeVisible();
  95  |   await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('');
  96  |   await page.getByRole('button', { name: 'Back to files' }).click();
  97  | 
  98  |   await createFromHome(page, 'spreadsheet');
  99  |   await expect(page.getByRole('textbox', { name: 'Spreadsheet title' })).toBeVisible();
  100 |   await expect(page.getByRole('textbox', { name: 'Cell A1', exact: true })).toHaveValue('');
  101 |   await expect(page.locator('.chart-panel')).toHaveCount(0);
  102 |   await page.getByRole('textbox', { name: 'Cell A1', exact: true }).pressSequentially('Revenue', { delay: 10 });
  103 |   await expect(page.getByRole('textbox', { name: 'Cell A1', exact: true })).toHaveValue('Revenue');
  104 |   await page.getByRole('textbox', { name: 'Cell B2', exact: true }).click();
  105 |   await page.getByRole('textbox', { name: 'Formula bar' }).pressSequentially('=2+3', { delay: 10 });
  106 |   await expect(page.getByRole('textbox', { name: 'Formula bar' })).toHaveValue('=2+3');
  107 |   await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toHaveValue('5');
  108 |   await page.getByRole('button', { name: 'Back to files' }).click();
  109 |   await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  110 | 
  111 |   await page.getByRole('textbox', { name: 'Search files' }).fill('memorandum');
  112 |   await expect(page.getByRole('alert')).toHaveText('Nothing found');
  113 |   await expect(page.getByRole('button', { name: 'Open Browser verified memorandum' })).toHaveCount(0);
  114 |   await expect(page.getByRole('button', { name: 'Open Untitled presentation' })).toHaveCount(0);
  115 |   await page.getByRole('textbox', { name: 'Search files' }).fill('');
  116 |   await expect(page.getByRole('button', { name: 'Open Browser verified memorandum' })).toBeVisible();
  117 | 
  118 |   await page.reload();
  119 |   await expect(page.getByText('Browser verified memorandum').first()).toBeVisible();
  120 |   await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  121 | 
  122 |   await page.getByRole('button', { name: 'Open Browser verified memorandum' }).click();
  123 |   await expect(page.getByRole('textbox', { name: 'Document body' })).toHaveText('Cloud memo body');
  124 |   await page.getByRole('button', { name: 'Back to files' }).click();
  125 |   await page.getByRole('button', { name: 'Open Untitled presentation' }).click();
  126 |   await expect(page.getByRole('textbox', { name: 'Slide title' })).toHaveText('A real slide');
  127 |   await page.getByRole('button', { name: 'Back to files' }).click();
  128 |   await page.getByRole('button', { name: 'Open Untitled spreadsheet' }).click();
  129 |   await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toHaveValue('5');
  130 |   await page.getByRole('button', { name: 'Back to files' }).click();
  131 | 
  132 |   await page.getByRole('button', { name: 'Actions for Browser verified memorandum' }).click();
> 133 |   await page.getByRole('button', { name: 'Delete', exact: true }).click();
      |                                                                   ^ Error: locator.click: Test timeout of 90000ms exceeded.
  134 |   await expect(page.getByText('Deleting file…')).toBeHidden();
  135 |   await expect(page.getByText('Browser verified memorandum')).toHaveCount(0);
  136 |   await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  137 |   await page.reload();
  138 |   await expect(page.getByText('Browser verified memorandum')).toHaveCount(0);
  139 | 
  140 |   const deleteAll = page.getByRole('button', { name: 'Delete all files' });
  141 |   await expect(deleteAll).toBeEnabled();
  142 |   await deleteAll.click();
  143 |   await expect(page.getByText('Deleting all files…')).toBeHidden();
  144 |   await expect(page.getByText('No files')).toBeVisible();
  145 |   await expect(deleteAll).toBeDisabled();
  146 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  147 |   await expect(page.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  148 |   await page.reload();
  149 |   await expect(page.getByText('No files')).toBeVisible();
  150 | 
  151 |   const cloud = await page.request.get('/api/workspace');
  152 |   expect(cloud.ok()).toBeTruthy();
  153 |   expect(cloud.headers()['cache-control']).toContain('no-store');
  154 |   expect(cloud.headers()['x-frame-options']).toBe('DENY');
  155 |   const cloudBody = (await cloud.json()) as { workspace: { files: unknown[] }; revision: number };
  156 |   expect(cloudBody.workspace.files).toEqual([]);
  157 |   expect(cloudBody.revision).toBeGreaterThan(0);
  158 |   expect(errors).toEqual([]);
  159 |   expect(nativeDialogs).toEqual([]);
  160 | });
  161 | 
  162 | test('capitalizes Kevin throughout the office editors', async ({ page }) => {
  163 |   await signIn(page, newIdentity('kevin'));
  164 | 
  165 |   const search = page.getByRole('textbox', { name: 'Search files' });
  166 |   await search.fill('kEvIn');
  167 |   await expect(search).toHaveValue('Kevin');
  168 | 
  169 |   await createFromHome(page, 'document');
  170 |   const documentTitle = page.getByRole('textbox', { name: 'Document title' });
  171 |   const documentBody = page.getByRole('textbox', { name: 'Document body' });
  172 |   await documentTitle.fill('KEVIN notes');
  173 |   await documentBody.pressSequentially('Ask kevin and KeViN');
  174 |   await expect(documentTitle).toHaveValue('Kevin notes');
  175 |   await expect(documentBody).toHaveText('Ask Kevin and Kevin');
  176 |   await page.getByRole('button', { name: 'Find' }).click();
  177 |   const find = page.getByPlaceholder('Type a thing');
  178 |   await find.fill('kevin');
  179 |   await expect(find).toHaveValue('Kevin');
  180 |   await page.getByRole('button', { name: 'Back to files' }).click();
  181 | 
  182 |   await createFromHome(page, 'presentation');
  183 |   const presentationTitle = page.getByRole('textbox', { name: 'Presentation title' });
  184 |   const slideTitle = page.getByRole('textbox', { name: 'Slide title' });
  185 |   const notes = page.locator('.speaker-notes textarea');
  186 |   await presentationTitle.fill('kevin deck');
  187 |   await slideTitle.pressSequentially('KEVIN presents');
  188 |   await notes.fill('Tell kEvIn');
  189 |   await expect(presentationTitle).toHaveValue('Kevin deck');
  190 |   await expect(slideTitle).toHaveText('Kevin presents');
  191 |   await expect(notes).toHaveValue('Tell Kevin');
  192 |   await page.getByRole('button', { name: 'Back to files' }).click();
  193 | 
  194 |   await createFromHome(page, 'spreadsheet');
  195 |   const spreadsheetTitle = page.getByRole('textbox', { name: 'Spreadsheet title' });
  196 |   const cell = page.getByRole('textbox', { name: 'Cell A1', exact: true });
  197 |   await spreadsheetTitle.fill('keVIN ledger');
  198 |   await cell.pressSequentially('kevin');
  199 |   await expect(spreadsheetTitle).toHaveValue('Kevin ledger');
  200 |   await expect(cell).toHaveValue('Kevin');
  201 | });
  202 | 
  203 | test('requires authentication, rejects bad development credentials, and isolates accounts', async ({ browser }) => {
  204 |   const firstContext = await browser.newContext();
  205 |   const first = await firstContext.newPage();
  206 |   const errors: string[] = [];
  207 |   first.on('console', (message) => {
  208 |     if (message.type() === 'error') errors.push(message.text());
  209 |   });
  210 |   const firstIdentity = newIdentity('isolation-a');
  211 | 
  212 |   await first.goto('/');
  213 |   await expect(first).toHaveURL(/\/login$/);
  214 |   await first.getByRole('link', { name: /Continue with Southbag Identity/ }).click();
  215 |   await first.getByRole('textbox', { name: 'Work email' }).fill(firstIdentity);
  216 |   await first.getByRole('textbox', { name: 'Name' }).fill('Account A');
  217 |   await first.getByRole('textbox', { name: 'Password' }).fill('wrong');
  218 |   await first.getByRole('button', { name: 'Authorise Office' }).click();
  219 |   await expect(first.getByText(/development identity disagrees/i)).toBeVisible();
  220 |   errors.length = 0;
  221 |   await first.getByRole('textbox', { name: 'Password' }).fill('southbag');
  222 |   await first.getByRole('button', { name: 'Authorise Office' }).click();
  223 |   await expect(first.locator('.office-app')).toHaveAttribute('data-ready', 'true');
  224 | 
  225 |   await createFromHome(first, 'document');
  226 |   await first.getByRole('textbox', { name: 'Document title' }).fill('Private to account A');
  227 |   await first.getByRole('button', { name: 'Back to files' }).click();
  228 |   await expect(first.getByRole('button', { name: /Saved to cloud/ })).toBeVisible();
  229 | 
  230 |   const secondContext = await browser.newContext();
  231 |   const second = await secondContext.newPage();
  232 |   await signIn(second, newIdentity('isolation-b'));
  233 |   await expect(second.getByText('No files')).toBeVisible();
```