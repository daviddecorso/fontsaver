import path from 'node:path';
import {
  type BrowserContext,
  test as base,
  chromium,
  expect,
} from '@playwright/test';

const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture syntax requires {}
  context: async ({}, use) => {
    const pathToExtension = path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', {
        timeout: 10000,
      });
    }
    const extensionId = background.url().split('/')[2];
    if (!extensionId) {
      throw new Error(
        'Failed to resolve extensionId from background service worker',
      );
    }
    await use(extensionId);
  },
});

test.describe('extension smoke tests', () => {
  test('popup UI renders with header and search controls', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('h1')).toHaveText('Favorites');
    await expect(page.getByPlaceholder('Search favorites...')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Open Library/i }),
    ).toBeVisible();
  });

  test('library UI renders with filters and preview controls', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/library.html`);

    await expect(page.locator('h1')).toHaveText('Font Library');
    await expect(page.locator('#search-fonts')).toBeVisible();
    await expect(page.locator('#preview-text')).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  });

  test('live grid: injects hearts on fonts.google.com and syncs to popup', async ({
    context,
    extensionId,
  }) => {
    test.skip(
      Boolean(process.env.SKIP_LIVE_TESTS),
      'Skipping live network tests (SKIP_LIVE_TESTS is set)',
    );

    test.setTimeout(45000);

    const page = await context.newPage();
    await page.goto('https://fonts.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const heartHost = await page.waitForSelector('.gff-heart-host', {
      timeout: 25000,
    });
    expect(heartHost).not.toBeNull();

    const family = await heartHost.getAttribute('data-gff-heart');
    expect(family).toBeTruthy();

    await heartHost.evaluate((host) => {
      const btn =
        host.shadowRoot?.querySelector<HTMLButtonElement>('.gff-heart-btn');
      btn?.click();
    });

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popupPage.getByText(family as string)).toBeVisible({
      timeout: 10000,
    });
  });
});
