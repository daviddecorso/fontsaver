import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  scanAndDecorate,
  setCachedCatalog,
  startObserver,
  stopObserver,
} from '../../../entrypoints/google-fonts.content/index';
import { SELECTORS } from '../../../entrypoints/google-fonts.content/selectors';
import {
  defineFavoriteItem,
  settingsItem,
  tagsItem,
} from '../../../src/storage/items';

const gridHtml = fs.readFileSync(path.resolve(__dirname, 'grid.html'), 'utf-8');
const specimenHtml = fs.readFileSync(
  path.resolve(__dirname, 'specimen.html'),
  'utf-8',
);

describe('DOM card decoration and content script against fixtures', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();
    document.documentElement.innerHTML = gridHtml;
    window.history.replaceState({}, '', '/');

    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    setCachedCatalog([
      {
        id: 'roboto',
        family: 'Roboto',
        category: 'sans-serif',
        variable: true,
        subsets: ['latin'],
        weights: [400, 700],
        styles: ['normal'],
      },
      {
        id: 'open-sans',
        family: 'Open Sans',
        category: 'sans-serif',
        variable: true,
        subsets: ['latin'],
        weights: [400, 700],
        styles: ['normal'],
      },
    ]);
  });

  afterEach(() => {
    stopObserver();
    vi.restoreAllMocks();
  });

  it('decorates every card on browse grid with exactly one heart host', () => {
    scanAndDecorate();

    const cards = document.querySelectorAll(SELECTORS.cardContainer);
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.hasAttribute(SELECTORS.cardMarker)).toBe(true);
      const hearts = card.querySelectorAll('[data-gff-heart]');
      expect(hearts).toHaveLength(1);
      const heart = hearts[0];
      const fontNameLink = card.querySelector<HTMLElement>('header a, a');
      if (
        heart &&
        fontNameLink &&
        heart.parentElement &&
        heart.parentElement === fontNameLink.parentElement
      ) {
        const children = Array.from(heart.parentElement.children);
        expect(children.indexOf(heart)).toBeLessThan(
          children.indexOf(fontNameLink),
        );
      }
    }
  });

  it('prevents duplicate hearts on simulated re-renders', () => {
    scanAndDecorate();
    const firstCount = document.querySelectorAll('[data-gff-heart]').length;
    expect(firstCount).toBe(5);

    // Re-run scan multiple times
    scanAndDecorate();
    scanAndDecorate();

    const secondCount = document.querySelectorAll('[data-gff-heart]').length;
    expect(secondCount).toBe(firstCount);
  });

  it('decorates dynamically appended cards via MutationObserver', async () => {
    startObserver(document.body);

    const grid = document.querySelector('.results-grid');
    expect(grid).not.toBeNull();

    const newCard = document.createElement('article');
    newCard.className = 'font-card';
    newCard.innerHTML = `
      <header>
        <a href="/specimen/Lora" class="font-name">Lora</a>
      </header>
    `;
    grid?.appendChild(newCard);

    // Allow mutation observer debounce / macrotask to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(newCard.hasAttribute(SELECTORS.cardMarker)).toBe(true);
    expect(newCard.querySelectorAll('[data-gff-heart]')).toHaveLength(1);
    expect(
      newCard.querySelector('[data-gff-heart]')?.getAttribute('data-gff-heart'),
    ).toBe('Lora');
  });

  it('toggles heart optimistically and persists to storage', async () => {
    scanAndDecorate();

    const robotoHost = document.querySelector<HTMLElement>(
      '[data-gff-heart="Roboto"]',
    );
    expect(robotoHost).not.toBeNull();
    const shadow = robotoHost?.shadowRoot;
    expect(shadow).not.toBeNull();

    const button = shadow?.querySelector<HTMLButtonElement>('.gff-heart-btn');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('favorited')).toBe(false);

    // Click to favorite
    button?.click();
    expect(button?.classList.contains('favorited')).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    // Verify storage write
    const robotoItem = defineFavoriteItem('roboto');
    const stored = await robotoItem.getValue();
    expect(stored).not.toBeNull();
    expect(stored?.family).toBe('Roboto');
    expect(stored?.id).toBe('roboto');

    // Click again to unfavorite
    button?.click();
    expect(button?.classList.contains('favorited')).toBe(false);
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    const removed = await robotoItem.getValue();
    expect(removed).toBeNull();
  });

  it('decorates specimen page family title and related font cards', () => {
    document.documentElement.innerHTML = specimenHtml;
    window.history.replaceState({}, '', '/specimen/Roboto');

    scanAndDecorate();

    const h1 = document.querySelector<HTMLHeadingElement>(
      SELECTORS.specimenTitle,
    );
    expect(h1).not.toBeNull();
    expect(h1?.hasAttribute(SELECTORS.cardMarker)).toBe(true);
    expect(h1?.querySelector('[data-gff-heart]')).not.toBeNull();

    // Related cards on specimen page should also be decorated
    const relatedCards = document.querySelectorAll('.results-grid article');
    expect(relatedCards.length).toBe(2);
    for (const card of relatedCards) {
      expect(card.hasAttribute(SELECTORS.cardMarker)).toBe(true);
      expect(card.querySelectorAll('[data-gff-heart]')).toHaveLength(1);
    }

    // Re-scan produces no duplicates
    scanAndDecorate();
    expect(h1?.querySelectorAll('[data-gff-heart]')).toHaveLength(1);
  });

  it('opens hover menu, displays tags, and toggles tag on favorite', async () => {
    await tagsItem.setValue([
      { id: 'sans', name: 'Sans Serif', color: '#1a73e8' },
      { id: 'work', name: 'Work', color: '#34a853' },
    ]);

    scanAndDecorate();

    const interHost = document.querySelector<HTMLElement>(
      '[data-gff-heart="Inter"]',
    );
    expect(interHost).not.toBeNull();
    const shadow = interHost?.shadowRoot;

    // Trigger right-click context menu
    interHost?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    // Wait for menu rendering
    await new Promise((resolve) => setTimeout(resolve, 20));

    const menu = shadow?.querySelector('.gff-menu');
    expect(menu?.classList.contains('visible')).toBe(true);

    const tagChips =
      shadow?.querySelectorAll<HTMLButtonElement>('.gff-tag-chip');
    expect(tagChips).toHaveLength(2);
    expect(tagChips?.[0]?.textContent).toBe('Sans Serif');

    // Click first tag chip to assign tag and auto-favorite
    tagChips?.[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const interItem = defineFavoriteItem('inter');
    const stored = await interItem.getValue();
    expect(stored).not.toBeNull();
    expect(stored?.tags).toContain('sans');
  });

  it('adjusts menu alignment if overflowing viewport on the right', async () => {
    scanAndDecorate();

    const host = document.querySelector<HTMLElement>(
      '[data-gff-heart="Roboto"]',
    );
    const shadow = host?.shadowRoot;
    const menu = shadow?.querySelector<HTMLElement>('.gff-menu');
    if (!menu) throw new Error('menu element not found');

    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      width: 210,
      height: 150,
      top: 100,
      bottom: 250,
      left: 950,
      right: 1160,
      x: 950,
      y: 100,
      toJSON: () => {},
    });

    host?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(menu?.style.right).toBe('0px');
    expect(menu?.style.left).toBe('auto');
  });

  it('copies snippets to clipboard and displays toast confirmation', async () => {
    await settingsItem.setValue({
      copyFormat: 'google-link',
      packageManager: 'pnpm',
      preferVariable: true,
      defaultWeights: [400, 700],
      display: 'swap',
      storageMode: 'sync',
    });

    scanAndDecorate();

    const host = document.querySelector<HTMLElement>(
      '[data-gff-heart="Roboto"]',
    );
    const shadow = host?.shadowRoot;

    host?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const copyButtons =
      shadow?.querySelectorAll<HTMLButtonElement>('.gff-action-btn');
    expect(copyButtons?.length).toBe(5);

    // Click Google <link> button
    copyButtons?.[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0]?.[0]).toContain(
      'fonts.googleapis.com/css2?family=Roboto',
    );

    const toast = shadow?.querySelector('.gff-toast');
    expect(toast?.classList.contains('visible')).toBe(true);
    expect(toast?.textContent).toContain('Copied Google <link>!');
  });

  it('sends open-library message when clicking open library button in empty tags menu', async () => {
    const sendMessageSpy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValue(undefined);

    scanAndDecorate();

    const host = document.querySelector<HTMLElement>(
      '[data-gff-heart="Roboto"]',
    );
    const shadow = host?.shadowRoot;

    host?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const openLibBtn =
      shadow?.querySelector<HTMLButtonElement>('.gff-open-lib-btn');
    expect(openLibBtn).not.toBeNull();
    openLibBtn?.click();

    expect(sendMessageSpy).toHaveBeenCalledWith({ type: 'open-library' });
  });
});
