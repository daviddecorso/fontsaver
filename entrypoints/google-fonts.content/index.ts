import type { CatalogFont } from '../../src/core/types';
import { catalogItem } from '../../src/storage/items';
import { mountHeartButton } from './heart';
import {
  extractFamilyFromHref,
  findCardElement,
  findMountTarget,
  isSpecimenPage,
  SELECTORS,
} from './selectors';

let cachedCatalog: CatalogFont[] | undefined;
let observer: MutationObserver | null = null;
let rafId: number | null = null;

export function setCachedCatalog(catalog?: CatalogFont[]): void {
  cachedCatalog = catalog;
}

export function scanAndDecorate(root: Document | HTMLElement = document): void {
  const links = root.querySelectorAll<HTMLAnchorElement>(
    SELECTORS.specimenLink,
  );

  for (const link of links) {
    const card = findCardElement(link);
    if (card.hasAttribute(SELECTORS.cardMarker)) continue;

    const href = link.getAttribute('href');
    if (!href) continue;

    const family = extractFamilyFromHref(href);
    if (!family) continue;

    card.setAttribute(SELECTORS.cardMarker, family);

    const target = findMountTarget(card, link);
    mountHeartButton(
      target.container,
      {
        family,
        catalog: cachedCatalog,
      },
      target.referenceNode,
    );
  }

  if (
    typeof window !== 'undefined' &&
    isSpecimenPage(window.location.pathname)
  ) {
    const title = root.querySelector<HTMLElement>(SELECTORS.specimenTitle);
    if (title && !title.hasAttribute(SELECTORS.cardMarker)) {
      const family =
        extractFamilyFromHref(window.location.pathname) ||
        title.textContent?.trim();

      if (family) {
        title.setAttribute(SELECTORS.cardMarker, family);
        mountHeartButton(
          title,
          {
            family,
            catalog: cachedCatalog,
          },
          title.firstChild,
        );
      }
    }
  }
}

export function scheduleScan(): void {
  if (rafId !== null) return;
  const scheduleFn =
    typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(cb, 16);

  rafId = scheduleFn(() => {
    rafId = null;
    scanAndDecorate();
  });
}

export function startObserver(target: Node = document.body): MutationObserver {
  stopObserver();
  scanAndDecorate();

  observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });

  return observer;
}

export function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (rafId !== null) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
    } else {
      clearTimeout(rafId);
    }
    rafId = null;
  }
}

export default defineContentScript({
  matches: ['https://fonts.google.com/*'],
  async main() {
    try {
      const catalog = await catalogItem.getValue();
      if (catalog?.fonts) {
        cachedCatalog = catalog.fonts;
      }
    } catch {
      // Catalog may not be cached yet; fallback to slugify
    }

    startObserver();
  },
});
