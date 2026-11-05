import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ExportData, Favorite } from '../../src/core/types';
import {
  catalogItem,
  createTag,
  defineFavoriteItem,
  deleteTag,
  exportLibraryData,
  getAllFavorites,
  getStorageQuotaStats,
  getTags,
  importLibraryData,
  migrateStorageMode,
  refreshCatalogCache,
  removeFavorite,
  saveFavorite,
  settingsItem,
  tagsItem,
  toggleFavoriteTag,
  updateTag,
  watchFavorites,
  watchStorageQuota,
} from '../../src/storage/items';

describe('storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('manages favorites lifecycle via getAllFavorites and watchFavorites', async () => {
    let watchCount = 0;
    let latestFavs: Favorite[] = [];
    const unwatch = watchFavorites((favs) => {
      watchCount++;
      latestFavs = favs;
    });

    expect(await getAllFavorites()).toEqual([]);

    const favItem = defineFavoriteItem('roboto');
    await favItem.setValue({
      id: 'roboto',
      family: 'Roboto',
      addedAt: 100,
      tags: [],
    });

    const favItem2 = defineFavoriteItem('open-sans');
    await favItem2.setValue({
      id: 'open-sans',
      family: 'Open Sans',
      addedAt: 200,
      tags: [],
    });

    const all = await getAllFavorites();
    expect(all).toHaveLength(2);
    // Should be sorted by addedAt descending
    expect(all[0]?.id).toBe('open-sans');
    expect(all[1]?.id).toBe('roboto');

    expect(watchCount).toBeGreaterThanOrEqual(1);
    expect(latestFavs.length).toBeGreaterThanOrEqual(1);

    await removeFavorite('roboto');
    const afterRemove = await getAllFavorites();
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0]?.id).toBe('open-sans');

    unwatch();
  });

  it('reads default settings and writes updates', async () => {
    const settings = await settingsItem.getValue();
    expect(settings.copyFormat).toBe('google-link');

    await settingsItem.setValue({
      ...settings,
      copyFormat: 'fontsource',
    });

    const updated = await settingsItem.getValue();
    expect(updated.copyFormat).toBe('fontsource');
  });

  it('defaults catalogItem to null and updates via refreshCatalogCache', async () => {
    expect(await catalogItem.getValue()).toBeNull();

    const mockFetch = async () =>
      ({
        ok: true,
        statusText: 'OK',
        json: async () => [
          {
            id: 'roboto',
            family: 'Roboto',
            category: 'sans-serif',
          },
        ],
      }) as unknown as Response;

    const catalog = await refreshCatalogCache(
      mockFetch as unknown as typeof fetch,
    );
    expect(catalog.fonts).toHaveLength(1);
    expect(catalog.fonts[0]?.id).toBe('roboto');

    const stored = await catalogItem.getValue();
    expect(stored).toEqual(catalog);
  });

  it('preserves existing catalog cache if refreshCatalogCache fails', async () => {
    const initialCatalog = {
      fetchedAt: 123456,
      fonts: [
        {
          id: 'inter',
          family: 'Inter',
          category: 'sans-serif',
          variable: true,
          subsets: ['latin'],
          weights: [400],
          styles: ['normal'],
        },
      ],
    };

    await catalogItem.setValue(initialCatalog);

    const failingFetch = async () =>
      ({
        ok: false,
        statusText: '503 Service Unavailable',
        json: async () => ({}),
      }) as unknown as Response;

    await expect(
      refreshCatalogCache(failingFetch as unknown as typeof fetch),
    ).rejects.toThrow('Failed to fetch catalog: 503 Service Unavailable');

    const stored = await catalogItem.getValue();
    expect(stored).toEqual(initialCatalog);
  });

  it('exports and imports library data cleanly with merge and replace', async () => {
    await defineFavoriteItem('inter', 'sync').setValue({
      id: 'inter',
      family: 'Inter',
      addedAt: 1000,
      tags: ['ui'],
    });
    await tagsItem.setValue([{ id: 'ui', name: 'UI', color: '#111' }]);

    const exported = await exportLibraryData();
    expect(exported.favorites).toHaveLength(1);
    expect(exported.tags).toHaveLength(1);

    const importData: ExportData = {
      version: 1,
      exportedAt: 2000,
      favorites: [
        {
          id: 'roboto',
          family: 'Roboto',
          addedAt: 1500,
          tags: ['body'],
        },
      ],
      tags: [{ id: 'body', name: 'Body', color: '#222' }],
    };

    // Test merge
    await importLibraryData(importData, 'merge');
    let all = await getAllFavorites();
    expect(all).toHaveLength(2);

    // Test replace
    await importLibraryData(importData, 'replace');
    all = await getAllFavorites();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe('roboto');
  });

  it('migrates storage mode between sync and local', async () => {
    await defineFavoriteItem('fira-code', 'sync').setValue({
      id: 'fira-code',
      family: 'Fira Code',
      addedAt: 300,
      tags: ['mono'],
    });
    await tagsItem.setValue([{ id: 'mono', name: 'Mono', color: '#333' }]);

    const { migratedCount } = await migrateStorageMode('local');
    expect(migratedCount).toBe(1);

    const localFavs = await getAllFavorites('local');
    expect(localFavs).toHaveLength(1);
    expect(localFavs[0]?.id).toBe('fira-code');

    const settings = await settingsItem.getValue();
    expect(settings.storageMode).toBe('local');
  });

  it('saves favorites and calculates quota stats via saveFavorite', async () => {
    const { favorite, quota } = await saveFavorite({
      id: 'montserrat',
      family: 'Montserrat',
      addedAt: 12345,
      tags: [],
    });

    expect(favorite.id).toBe('montserrat');
    expect(quota.itemCount).toBeGreaterThan(0);
    expect(quota.bytesUsed).toBeGreaterThan(0);
    expect(quota.isNearLimit).toBe(false);

    const favs = await getAllFavorites();
    expect(favs.find((f) => f.id === 'montserrat')).toBeDefined();
  });

  it('watches storage quota changes', async () => {
    let notifiedQuota: number | null = null;
    const unwatch = watchStorageQuota((stats) => {
      notifiedQuota = stats.itemCount;
    });

    await saveFavorite({
      id: 'lora',
      family: 'Lora',
      addedAt: 20000,
      tags: [],
    });

    expect(notifiedQuota).not.toBeNull();
    unwatch();
  });

  it('rejects invalid import payloads with an error', async () => {
    await expect(importLibraryData({ invalid: true })).rejects.toThrow(
      'Missing or invalid "version" field',
    );
  });

  it('reports quota usage statistics', async () => {
    const stats = await getStorageQuotaStats();
    expect(stats.totalBytes).toBe(102400);
    expect(stats.maxItems).toBe(512);
    expect(typeof stats.bytesUsed).toBe('number');
    expect(stats.isNearLimit).toBe(false);
  });

  it('manages tags lifecycle and cascading deletions across favorites', async () => {
    expect(await getTags()).toEqual([]);

    const tag1 = await createTag('Display', '#ef4444');
    expect(tag1.name).toBe('Display');
    expect(tag1.color).toBe('#ef4444');

    const tag2 = await createTag('Body Text', '#3b82f6');
    expect(await getTags()).toHaveLength(2);

    // Renaming / recoloring
    const updatedTags = await updateTag(tag1.id, {
      name: 'Hero Display',
      color: '#10b981',
    });
    expect(updatedTags.find((t) => t.id === tag1.id)?.name).toBe(
      'Hero Display',
    );
    expect(updatedTags.find((t) => t.id === tag1.id)?.color).toBe('#10b981');

    // Create a favorite with tag1 and tag2
    await defineFavoriteItem('playfair').setValue({
      id: 'playfair',
      family: 'Playfair Display',
      addedAt: 500,
      tags: [tag1.id, tag2.id],
    });

    // Toggle favorite tag
    const toggled = await toggleFavoriteTag('playfair', tag2.id);
    expect(toggled?.tags).toEqual([tag1.id]);

    // Re-add tag2
    await toggleFavoriteTag('playfair', tag2.id);

    // Delete tag1 - verify cascading deletion from favorites
    await deleteTag(tag1.id);
    const tagsAfterDelete = await getTags();
    expect(tagsAfterDelete).toHaveLength(1);
    expect(tagsAfterDelete[0]?.id).toBe(tag2.id);

    const fav = (await getAllFavorites()).find((f) => f.id === 'playfair');
    expect(fav?.tags).toEqual([tag2.id]);
  });
});
