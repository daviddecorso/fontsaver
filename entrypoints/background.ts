import { browser } from 'wxt/browser';
import { familyNameToFontId } from '../src/core/family-id';
import {
  catalogItem,
  refreshCatalogCache,
  saveFavorite,
} from '../src/storage/items';

export const CATALOG_ALARM_NAME = 'catalog-refresh';
export const CATALOG_REFRESH_INTERVAL_MINUTES = 7 * 24 * 60;

export const MENU_OPEN_LIBRARY = 'open-library';
export const MENU_OPEN_OPTIONS = 'open-options';
export const MENU_FAVORITE_SPECIMEN = 'favorite-specimen';

export async function setupContextMenus(): Promise<void> {
  if (browser.contextMenus?.removeAll) {
    try {
      await browser.contextMenus.removeAll();
    } catch {
      // Fallback for environments where removeAll is not implemented
    }
  }

  if (browser.contextMenus?.create) {
    browser.contextMenus.create({
      id: MENU_OPEN_LIBRARY,
      title: 'Open Font Library',
      contexts: ['action', 'page'],
    });

    browser.contextMenus.create({
      id: MENU_OPEN_OPTIONS,
      title: 'Preferences & Settings',
      contexts: ['action'],
    });

    browser.contextMenus.create({
      id: MENU_FAVORITE_SPECIMEN,
      title: 'Favorite this Font',
      contexts: ['link'],
      targetUrlPatterns: ['*://fonts.google.com/specimen/*'],
    });
  }
}

export async function handleContextMenuClick(
  info: { menuItemId: string | number; linkUrl?: string },
  _tab?: unknown,
): Promise<boolean> {
  if (info.menuItemId === MENU_OPEN_LIBRARY) {
    const url = browser.runtime.getURL('/library.html');
    await browser.tabs.create({ url });
    return true;
  }

  if (info.menuItemId === MENU_OPEN_OPTIONS) {
    try {
      if (browser.runtime?.openOptionsPage) {
        await browser.runtime.openOptionsPage();
        return true;
      }
    } catch {
      // Fallback to tabs.create if openOptionsPage throws or is unavailable
    }
    const url = browser.runtime.getURL('/options.html');
    await browser.tabs.create({ url });
    return true;
  }

  if (info.menuItemId === MENU_FAVORITE_SPECIMEN && info.linkUrl) {
    const match = info.linkUrl.match(/\/specimen\/([^/?#]+)/);
    if (!match?.[1]) return false;

    const family = decodeURIComponent(match[1].replace(/\+/g, ' '));
    const catalog = await catalogItem.getValue();
    const fontId = familyNameToFontId(family, catalog?.fonts);

    await saveFavorite({
      id: fontId,
      family,
      addedAt: Date.now(),
      tags: [],
    });
    return true;
  }

  return false;
}

export async function handleCatalogAlarm(
  alarm: { name: string },
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (alarm.name !== CATALOG_ALARM_NAME) {
    return false;
  }
  try {
    await refreshCatalogCache(fetchFn);
    return true;
  } catch (error) {
    console.error('Failed to refresh catalog on alarm:', error);
    return false;
  }
}

export async function handleInstall(
  details: { reason: string },
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  await ensureCatalogAlarm();
  await setupContextMenus();

  try {
    if (details.reason === 'install') {
      await refreshCatalogCache(fetchFn);
    } else {
      const existing = await catalogItem.getValue();
      if (!existing) {
        await refreshCatalogCache(fetchFn);
      }
    }
  } catch (error) {
    console.error('Failed to populate catalog on install/update:', error);
  }
}

export async function ensureCatalogAlarm(): Promise<void> {
  const existingAlarm = await browser.alarms.get(CATALOG_ALARM_NAME);
  if (!existingAlarm) {
    await browser.alarms.create(CATALOG_ALARM_NAME, {
      periodInMinutes: CATALOG_REFRESH_INTERVAL_MINUTES,
    });
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void handleInstall(details);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    void handleCatalogAlarm(alarm);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void handleContextMenuClick(info, tab);
  });

  void ensureCatalogAlarm();
});
