import { browser } from 'wxt/browser';
import {
  extractFamilyFromHref,
  familyNameToFontId,
} from '../src/core/family-id';
import {
  catalogItem,
  defineFavoriteItem,
  getActiveStorageMode,
  refreshCatalogCache,
  saveFavorite,
} from '../src/storage/items';

export const CATALOG_ALARM_NAME = 'catalog-refresh';
export const CATALOG_REFRESH_INTERVAL_MINUTES = 7 * 24 * 60;

export const MENU_OPEN_LIBRARY = 'open-library';
export const MENU_OPEN_SIDEPANEL = 'open-sidepanel';
export const MENU_OPEN_OPTIONS = 'open-options';
export const MENU_FAVORITE_SPECIMEN = 'favorite-specimen';

export const MESSAGE_OPEN_LIBRARY = 'open-library';
export const MESSAGE_OPEN_OPTIONS = 'open-options';

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
      id: MENU_OPEN_SIDEPANEL,
      title: 'Open in Side Panel',
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

  if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
    const chromeWithSidePanel = (
      globalThis as unknown as {
        chrome?: {
          sidePanel?: {
            open?: (opts: { windowId?: number }) => Promise<void>;
          };
        };
      }
    ).chrome;
    const tabObj = _tab as { windowId?: number } | undefined;
    if (chromeWithSidePanel?.sidePanel?.open && tabObj?.windowId) {
      try {
        await chromeWithSidePanel.sidePanel.open({
          windowId: tabObj.windowId,
        });
        return true;
      } catch {
        // Fallback to tabs.create
      }
    }
    const url = browser.runtime.getURL('/sidepanel.html');
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
    const rawFamily = extractFamilyFromHref(info.linkUrl);
    if (!rawFamily) return false;

    const catalog = await catalogItem.getValue();
    const fontId = familyNameToFontId(rawFamily, catalog?.fonts);
    const family =
      catalog?.fonts.find((font) => font.id === fontId)?.family ?? rawFamily;

    try {
      const mode = await getActiveStorageMode();
      const existing = await defineFavoriteItem(fontId, mode).getValue();
      if (existing) return true;

      await saveFavorite(
        { id: fontId, family, addedAt: Date.now(), tags: [] },
        mode,
      );
      return true;
    } catch (error) {
      console.error('Failed to favorite font from context menu:', error);
      return false;
    }
  }

  return false;
}

export async function handleMessage(message: unknown): Promise<boolean> {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }

  const { type } = message as { type: unknown };

  if (type === MESSAGE_OPEN_LIBRARY) {
    const url = browser.runtime.getURL('/library.html');
    await browser.tabs.create({ url });
    return true;
  }

  if (type === MESSAGE_OPEN_OPTIONS) {
    try {
      if (browser.runtime?.openOptionsPage) {
        await browser.runtime.openOptionsPage();
        return true;
      }
    } catch {
      // Fallback
    }
    const url = browser.runtime.getURL('/options.html');
    await browser.tabs.create({ url });
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

export async function ensureCatalogPopulated(
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    if (await catalogItem.getValue()) return false;
    await refreshCatalogCache(fetchFn);
    return true;
  } catch (error) {
    console.error('Failed to populate missing catalog:', error);
    return false;
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

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      ((message as { type: unknown }).type === MESSAGE_OPEN_LIBRARY ||
        (message as { type: unknown }).type === MESSAGE_OPEN_OPTIONS)
    ) {
      handleMessage(message)
        .catch((error) => {
          console.error('Failed to handle message:', error);
          return false;
        })
        .then(sendResponse);
      return true;
    }
  });

  void ensureCatalogAlarm();
  void ensureCatalogPopulated();
});
