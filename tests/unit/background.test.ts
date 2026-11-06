import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CATALOG_ALARM_NAME,
  CATALOG_REFRESH_INTERVAL_MINUTES,
  handleCatalogAlarm,
  handleContextMenuClick,
  handleInstall,
  handleMessage,
  MENU_FAVORITE_SPECIMEN,
  MENU_OPEN_LIBRARY,
  MENU_OPEN_OPTIONS,
  MENU_OPEN_SIDEPANEL,
  MESSAGE_OPEN_LIBRARY,
  MESSAGE_OPEN_OPTIONS,
  setupContextMenus,
} from '../../entrypoints/background';
import { catalogItem, getAllFavorites } from '../../src/storage/items';

describe('background catalog caching', () => {
  const mockFontData = [
    {
      id: 'open-sans',
      family: 'Open Sans',
      category: 'sans-serif',
      variable: true,
      subsets: ['latin'],
      weights: [400, 700],
      styles: ['normal'],
    },
  ];

  const createMockFetch = (data = mockFontData, ok = true) => {
    return (async () => ({
      ok,
      statusText: ok ? 'OK' : 'Network Error',
      json: async () => data,
    })) as unknown as typeof fetch;
  };

  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.contextMenus.removeAll = vi.fn().mockResolvedValue(undefined);
    fakeBrowser.contextMenus.create = vi.fn();
    fakeBrowser.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);
  });

  describe('handleInstall', () => {
    it('creates weekly alarm and populates catalog on install', async () => {
      const mockFetch = createMockFetch();
      await handleInstall({ reason: 'install' }, mockFetch);

      const alarm = await fakeBrowser.alarms.get(CATALOG_ALARM_NAME);
      expect(alarm).toBeDefined();
      expect(alarm?.name).toBe(CATALOG_ALARM_NAME);
      expect(alarm?.periodInMinutes).toBe(CATALOG_REFRESH_INTERVAL_MINUTES);

      const catalog = await catalogItem.getValue();
      expect(catalog).not.toBeNull();
      expect(catalog?.fonts[0]?.id).toBe('open-sans');
    });

    it('creates alarm on update and preserves existing catalog cache', async () => {
      const existingCatalog = {
        fetchedAt: 1000,
        fonts: [
          {
            id: 'existing-font',
            family: 'Existing',
            category: 'sans-serif',
            variable: false,
            subsets: ['latin'],
            weights: [400],
            styles: ['normal'],
          },
        ],
      };
      await catalogItem.setValue(existingCatalog);

      const fetchSpy = vi.fn(createMockFetch());
      await handleInstall({ reason: 'update' }, fetchSpy);

      const alarm = await fakeBrowser.alarms.get(CATALOG_ALARM_NAME);
      expect(alarm?.periodInMinutes).toBe(CATALOG_REFRESH_INTERVAL_MINUTES);

      expect(fetchSpy).not.toHaveBeenCalled();
      const catalog = await catalogItem.getValue();
      expect(catalog).toEqual(existingCatalog);
    });

    it('handles install fetch failure gracefully without uncaught rejection', async () => {
      const failingFetch = createMockFetch([], false);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await handleInstall({ reason: 'install' }, failingFetch);

      expect(consoleSpy).toHaveBeenCalled();
      expect(await catalogItem.getValue()).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('handleCatalogAlarm', () => {
    it('refreshes catalog cache when alarm name matches', async () => {
      const mockFetch = createMockFetch();
      const handled = await handleCatalogAlarm(
        { name: CATALOG_ALARM_NAME },
        mockFetch,
      );

      expect(handled).toBe(true);
      const catalog = await catalogItem.getValue();
      expect(catalog?.fonts[0]?.id).toBe('open-sans');
    });

    it('ignores alarms with non-matching names', async () => {
      const fetchSpy = vi.fn(createMockFetch());
      const handled = await handleCatalogAlarm(
        { name: 'other-alarm' },
        fetchSpy,
      );

      expect(handled).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await catalogItem.getValue()).toBeNull();
    });

    it('handles alarm fetch failure gracefully without throwing', async () => {
      const failingFetch = createMockFetch([], false);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const handled = await handleCatalogAlarm(
        { name: CATALOG_ALARM_NAME },
        failingFetch,
      );

      expect(handled).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      expect(await catalogItem.getValue()).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('context menus', () => {
    it('registers context menus on setupContextMenus', async () => {
      await setupContextMenus();

      expect(fakeBrowser.contextMenus.removeAll).toHaveBeenCalled();
      expect(fakeBrowser.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MENU_OPEN_LIBRARY,
          title: 'Open Font Library',
        }),
      );
      expect(fakeBrowser.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MENU_OPEN_SIDEPANEL,
          title: 'Open in Side Panel',
        }),
      );
      expect(fakeBrowser.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MENU_OPEN_OPTIONS,
          title: 'Preferences & Settings',
        }),
      );
      expect(fakeBrowser.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MENU_FAVORITE_SPECIMEN,
          title: 'Favorite this Font',
          targetUrlPatterns: ['*://fonts.google.com/specimen/*'],
        }),
      );
    });

    it('handles open-library menu click', async () => {
      const tabsCreateSpy = vi.spyOn(fakeBrowser.tabs, 'create');
      const handled = await handleContextMenuClick({
        menuItemId: MENU_OPEN_LIBRARY,
      });

      expect(handled).toBe(true);
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: expect.stringContaining('/library.html'),
      });
    });

    it('handles open-sidepanel menu click', async () => {
      const tabsCreateSpy = vi.spyOn(fakeBrowser.tabs, 'create');
      const handled = await handleContextMenuClick({
        menuItemId: MENU_OPEN_SIDEPANEL,
      });

      expect(handled).toBe(true);
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: expect.stringContaining('/sidepanel.html'),
      });
    });

    it('handles open-options menu click', async () => {
      const handled = await handleContextMenuClick({
        menuItemId: MENU_OPEN_OPTIONS,
      });

      expect(handled).toBe(true);
      expect(fakeBrowser.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('handles favorite-specimen menu click and saves font', async () => {
      await catalogItem.setValue({
        fetchedAt: Date.now(),
        fonts: [
          {
            id: 'playfair-display',
            family: 'Playfair Display',
            category: 'serif',
            variable: true,
            subsets: ['latin'],
            weights: [400, 700],
            styles: ['normal'],
          },
        ],
      });

      const handled = await handleContextMenuClick({
        menuItemId: MENU_FAVORITE_SPECIMEN,
        linkUrl: 'https://fonts.google.com/specimen/Playfair+Display',
      });

      expect(handled).toBe(true);
      const favs = await getAllFavorites();
      expect(favs).toHaveLength(1);
      expect(favs[0]?.id).toBe('playfair-display');
      expect(favs[0]?.family).toBe('Playfair Display');
    });

    it('ignores unknown menu items or invalid specimen urls', async () => {
      expect(
        await handleContextMenuClick({
          menuItemId: 'unknown-menu',
        }),
      ).toBe(false);

      expect(
        await handleContextMenuClick({
          menuItemId: MENU_FAVORITE_SPECIMEN,
          linkUrl: 'https://fonts.google.com/about',
        }),
      ).toBe(false);
    });
  });

  describe('runtime messages', () => {
    it('handles open-library message and opens library tab', async () => {
      const tabsCreateSpy = vi.spyOn(fakeBrowser.tabs, 'create');
      const handled = await handleMessage({ type: MESSAGE_OPEN_LIBRARY });

      expect(handled).toBe(true);
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: expect.stringContaining('/library.html'),
      });
    });

    it('handles open-options message and opens options', async () => {
      const handled = await handleMessage({ type: MESSAGE_OPEN_OPTIONS });

      expect(handled).toBe(true);
      expect(fakeBrowser.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('ignores unknown message types or malformed messages', async () => {
      expect(await handleMessage({ type: 'unknown' })).toBe(false);
      expect(await handleMessage(null)).toBe(false);
      expect(await handleMessage('string')).toBe(false);
    });
  });
});
