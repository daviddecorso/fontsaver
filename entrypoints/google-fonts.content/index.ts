import type { CatalogFont } from '../../src/core/types';
import { catalogItem } from '../../src/storage/items';
import { type MountedHeart, mountHeartButton } from './heart';
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

const mountedHearts = new WeakMap<
  HTMLElement,
  { family: string; heart: MountedHeart }
>();

// Google recycles elements, so a heart is stale if its family changed or its host was detached.
function claimElement(element: HTMLElement, family: string): boolean {
  const existing = mountedHearts.get(element);
  if (
    existing &&
    existing.family === family &&
    existing.heart.host.isConnected
  ) {
    return false;
  }
  existing?.heart.unmount();
  mountedHearts.delete(element);
  element.setAttribute(SELECTORS.cardMarker, family);
  return true;
}

export function scanAndDecorate(root: Document | HTMLElement = document): void {
  const links = root.querySelectorAll<HTMLAnchorElement>(
    SELECTORS.specimenLink,
  );
  const handledCards = new Set<HTMLElement>();

  for (const link of links) {
    const card = findCardElement(link);
    if (handledCards.has(card)) continue;

    const href = link.getAttribute('href');
    if (!href) continue;

    const family = extractFamilyFromHref(href);
    if (!family) continue;

    handledCards.add(card);
    if (!claimElement(card, family)) continue;

    const target = findMountTarget(card, link);
    const heart = mountHeartButton(
      target.container,
      {
        family,
        catalog: cachedCatalog,
      },
      target.referenceNode,
    );
    mountedHearts.set(card, { family, heart });
  }

  if (
    typeof window !== 'undefined' &&
    isSpecimenPage(window.location.pathname)
  ) {
    const title = root.querySelector<HTMLElement>(SELECTORS.specimenTitle);
    if (title) {
      const family =
        extractFamilyFromHref(window.location.pathname) ||
        title.textContent?.trim();

      if (family && claimElement(title, family)) {
        const heart = mountHeartButton(
          title,
          {
            family,
            catalog: cachedCatalog,
          },
          title.firstChild,
        );
        mountedHearts.set(title, { family, heart });
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

    catalogItem.watch((next) => {
      cachedCatalog = next?.fonts;
    });

    startObserver();
  },
});
