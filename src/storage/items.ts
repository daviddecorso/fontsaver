import { storage } from '@wxt-dev/storage';
import { browser } from 'wxt/browser';
import { fetchCatalog } from '../core/catalog';
import {
  calculateStorageUsage,
  createExportPayload,
  exceedsSyncQuota,
  mergeFavorites,
  mergeTags,
  validateExportData,
} from '../core/export-import';
import {
  createTagRecord,
  deleteTagRecord,
  toggleFavoriteTagId,
  updateTagRecord,
  validateTagName,
} from '../core/tags';
import type {
  Catalog,
  ExportData,
  Favorite,
  Settings,
  StorageMode,
  StorageQuotaStats,
  Tag,
} from '../core/types';
import { STORAGE_VERSION } from './migrations';

export const defaultSettings: Settings = {
  copyFormat: 'google-link',
  packageManager: 'pnpm',
  preferVariable: true,
  defaultWeights: [400, 700],
  display: 'swap',
  storageMode: 'sync',
};

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  defaultValue: defaultSettings,
  version: STORAGE_VERSION,
});

export const tagsItem = storage.defineItem<Tag[]>('sync:tags', {
  defaultValue: [],
  version: STORAGE_VERSION,
});

export const localTagsItem = storage.defineItem<Tag[]>('local:tags', {
  defaultValue: [],
  version: STORAGE_VERSION,
});

export function getTagsItem(mode?: StorageMode) {
  return mode === 'local' ? localTagsItem : tagsItem;
}

export async function getActiveStorageMode(): Promise<StorageMode> {
  const settings = await settingsItem.getValue();
  return settings?.storageMode ?? 'sync';
}

export async function getTags(mode?: StorageMode): Promise<Tag[]> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const item = getTagsItem(targetMode);
  return (await item.getValue()) ?? [];
}

export async function saveTags(tags: Tag[], mode?: StorageMode): Promise<void> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const item = getTagsItem(targetMode);
  await item.setValue(tags);
}

export function watchTags(callback: (tags: Tag[]) => void): () => void {
  const update = () => {
    void getTags().then(callback);
  };

  const listener = (changes: Record<string, unknown>, areaName: string) => {
    if (areaName === 'sync' || areaName === 'local') {
      const hasTagChange = Object.keys(changes).some(
        (key) =>
          key === 'tags' ||
          key === 'sync:tags' ||
          key === 'local:tags' ||
          key === 'settings' ||
          key === 'sync:settings',
      );
      if (hasTagChange) {
        update();
      }
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

export async function createTag(
  name: string,
  color?: string,
  mode?: StorageMode,
): Promise<Tag> {
  const currentTags = await getTags(mode);
  const validation = validateTagName(name, currentTags);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const newTag = createTagRecord(name, color);
  const nextTags = [...currentTags, newTag];
  await saveTags(nextTags, mode);
  return newTag;
}

export async function updateTag(
  tagId: string,
  updates: Partial<Pick<Tag, 'name' | 'color'>>,
  mode?: StorageMode,
): Promise<Tag[]> {
  const currentTags = await getTags(mode);
  if (updates.name !== undefined) {
    const validation = validateTagName(updates.name, currentTags, tagId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }
  const nextTags = updateTagRecord(currentTags, tagId, updates);
  await saveTags(nextTags, mode);
  return nextTags;
}

export async function deleteTag(
  tagId: string,
  mode?: StorageMode,
): Promise<void> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const currentTags = await getTags(targetMode);
  const nextTags = deleteTagRecord(currentTags, tagId);
  await saveTags(nextTags, targetMode);

  const favs = await getAllFavorites(targetMode);
  const affected = favs.filter((f) => f.tags.includes(tagId));
  for (const fav of affected) {
    const updated = {
      ...fav,
      tags: fav.tags.filter((id) => id !== tagId),
    };
    await defineFavoriteItem(fav.id, targetMode).setValue(updated);
  }
}

export async function toggleFavoriteTag(
  fontId: string,
  tagId: string,
  mode?: StorageMode,
): Promise<Favorite | null> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const item = defineFavoriteItem(fontId, targetMode);
  const fav = await item.getValue();
  if (!fav) return null;

  const updated = toggleFavoriteTagId(fav, tagId);
  await item.setValue(updated);
  return updated;
}

export const catalogItem = storage.defineItem<Catalog | null>('local:catalog', {
  defaultValue: null,
  version: STORAGE_VERSION,
});

export function getFavoriteKey(
  fontId: string,
  mode: StorageMode = 'sync',
): `${StorageMode}:fav:${string}` {
  return `${mode}:fav:${fontId}`;
}

export function defineFavoriteItem(fontId: string, mode: StorageMode = 'sync') {
  return storage.defineItem<Favorite | null>(getFavoriteKey(fontId, mode), {
    defaultValue: null,
    version: STORAGE_VERSION,
  });
}

export async function getAllFavorites(mode?: StorageMode): Promise<Favorite[]> {
  const settings = await settingsItem.getValue();
  const targetMode = mode ?? settings?.storageMode ?? 'sync';
  const data = (await storage.snapshot(targetMode)) as Record<string, unknown>;
  const favorites: Favorite[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (
      key.startsWith('fav:') &&
      value &&
      typeof value === 'object' &&
      'id' in value &&
      'family' in value
    ) {
      favorites.push(value as Favorite);
    }
  }
  return favorites.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

export async function saveFavorite(
  fav: Favorite,
  mode?: StorageMode,
): Promise<{ favorite: Favorite; quota: StorageQuotaStats }> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const item = defineFavoriteItem(fav.id, targetMode);
  await item.setValue(fav);
  const quota = await getStorageQuotaStats();
  return { favorite: fav, quota };
}

export async function updateFavoriteNote(
  fontId: string,
  note: string,
  mode?: StorageMode,
): Promise<Favorite | null> {
  const targetMode = mode ?? (await getActiveStorageMode());
  const item = defineFavoriteItem(fontId, targetMode);
  const fav = await item.getValue();
  if (!fav) return null;

  const trimmed = note.trim();
  const updated: Favorite = {
    ...fav,
    note: trimmed.length > 0 ? trimmed : undefined,
  };
  await item.setValue(updated);
  return updated;
}

export async function removeFavorite(
  fontId: string,
  mode?: StorageMode,
): Promise<void> {
  if (mode) {
    const item = defineFavoriteItem(fontId, mode);
    await item.removeValue();
  } else {
    await defineFavoriteItem(fontId, 'sync').removeValue();
    await defineFavoriteItem(fontId, 'local').removeValue();
  }
}

export function watchFavorites(
  callback: (favorites: Favorite[]) => void,
): () => void {
  const update = () => {
    void getAllFavorites().then(callback);
  };

  const listener = (changes: Record<string, unknown>, areaName: string) => {
    if (areaName === 'sync' || areaName === 'local') {
      const hasFavChange = Object.keys(changes).some(
        (key) =>
          key.startsWith('fav:') ||
          key.startsWith('sync:fav:') ||
          key.startsWith('local:fav:'),
      );
      if (hasFavChange) {
        update();
      }
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

export async function refreshCatalogCache(
  fetchFn: typeof fetch = fetch,
): Promise<Catalog> {
  const catalog = await fetchCatalog(fetchFn);
  await catalogItem.setValue(catalog);
  return catalog;
}

export async function getStorageQuotaStats(): Promise<StorageQuotaStats> {
  const syncSnapshot = (await storage.snapshot('sync')) as Record<
    string,
    unknown
  >;
  return calculateStorageUsage(syncSnapshot);
}

export function watchStorageQuota(
  callback: (stats: StorageQuotaStats) => void,
): () => void {
  void getStorageQuotaStats().then(callback);

  const listener = (_changes: Record<string, unknown>, areaName: string) => {
    if (areaName === 'sync') {
      void getStorageQuotaStats().then(callback);
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

function favoriteSyncKey(fav: Favorite): string {
  return `fav:${fav.id}`;
}

async function assertFitsSyncQuota(change: {
  removedKeys: string[];
  entries: Record<string, unknown>;
}): Promise<void> {
  const snapshot = {
    ...((await storage.snapshot('sync')) as Record<string, unknown>),
  };
  for (const key of change.removedKeys) delete snapshot[key];
  Object.assign(snapshot, change.entries);
  if (exceedsSyncQuota(snapshot)) {
    throw new Error(
      'This would exceed the sync storage limit. Switch to local storage or use fewer fonts.',
    );
  }
}

export async function exportLibraryData(): Promise<ExportData> {
  const settings = (await settingsItem.getValue()) ?? defaultSettings;
  const favorites = await getAllFavorites();
  const currentTagsItem =
    settings.storageMode === 'local' ? localTagsItem : tagsItem;
  const tags =
    (await currentTagsItem.getValue()) ?? (await tagsItem.getValue()) ?? [];
  return createExportPayload(favorites, tags, settings);
}

export async function importLibraryData(
  exportData: unknown,
  mode: 'merge' | 'replace' = 'merge',
): Promise<{ favoritesCount: number; tagsCount: number }> {
  const validation = validateExportData(exportData);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const validPayload = validation.data;

  const settings = (await settingsItem.getValue()) ?? defaultSettings;
  const targetMode = settings.storageMode ?? 'sync';
  const targetTagsItem = targetMode === 'local' ? localTagsItem : tagsItem;

  const existing = await getAllFavorites(targetMode);
  let finalFavorites: Favorite[];
  let finalTags: Tag[];

  if (mode === 'replace') {
    finalFavorites = validPayload.favorites;
    finalTags = validPayload.tags;
  } else {
    const existingTags = (await targetTagsItem.getValue()) ?? [];
    finalFavorites = mergeFavorites(existing, validPayload.favorites);
    finalTags = mergeTags(existingTags, validPayload.tags);
  }

  const nextSettings: Settings | undefined = validPayload.settings
    ? { ...settings, ...validPayload.settings, storageMode: targetMode }
    : undefined;

  if (targetMode === 'sync') {
    await assertFitsSyncQuota({
      removedKeys: mode === 'replace' ? existing.map(favoriteSyncKey) : [],
      entries: {
        ...Object.fromEntries(
          finalFavorites.map((f) => [favoriteSyncKey(f), f]),
        ),
        tags: finalTags,
        ...(nextSettings ? { settings: nextSettings } : {}),
      },
    });
  }

  for (const fav of finalFavorites) {
    await defineFavoriteItem(fav.id, targetMode).setValue(fav);
  }
  await targetTagsItem.setValue(finalTags);

  if (mode === 'replace') {
    const keptIds = new Set(finalFavorites.map((f) => f.id));
    for (const fav of existing) {
      if (!keptIds.has(fav.id)) {
        await defineFavoriteItem(fav.id, targetMode).removeValue();
      }
    }
  }

  if (nextSettings) {
    await settingsItem.setValue(nextSettings);
  }

  return {
    favoritesCount: finalFavorites.length,
    tagsCount: finalTags.length,
  };
}

export async function migrateStorageMode(
  targetMode: StorageMode,
): Promise<{ migratedCount: number }> {
  const sourceMode: StorageMode = targetMode === 'sync' ? 'local' : 'sync';
  const sourceFavs = await getAllFavorites(sourceMode);
  const sourceTagsItem = sourceMode === 'sync' ? tagsItem : localTagsItem;
  const targetTagsItem = targetMode === 'sync' ? tagsItem : localTagsItem;

  const sourceTags = (await sourceTagsItem.getValue()) ?? [];
  const targetTags = (await targetTagsItem.getValue()) ?? [];
  const mergedTags = mergeTags(targetTags, sourceTags);

  if (targetMode === 'sync') {
    await assertFitsSyncQuota({
      removedKeys: [],
      entries: {
        ...Object.fromEntries(sourceFavs.map((f) => [favoriteSyncKey(f), f])),
        tags: mergedTags,
      },
    });
  }

  const preexistingTargetIds = new Set(
    (await getAllFavorites(targetMode)).map((f) => f.id),
  );
  const copiedIds: string[] = [];

  try {
    for (const fav of sourceFavs) {
      await defineFavoriteItem(fav.id, targetMode).setValue(fav);
      if (!preexistingTargetIds.has(fav.id)) copiedIds.push(fav.id);
    }
    await targetTagsItem.setValue(mergedTags);
  } catch (error) {
    for (const id of copiedIds) {
      await defineFavoriteItem(id, targetMode).removeValue();
    }
    throw error;
  }

  const currentSettings = (await settingsItem.getValue()) ?? defaultSettings;
  await settingsItem.setValue({
    ...currentSettings,
    storageMode: targetMode,
  });

  for (const fav of sourceFavs) {
    await defineFavoriteItem(fav.id, sourceMode).removeValue();
  }
  await sourceTagsItem.setValue([]);

  return { migratedCount: sourceFavs.length };
}
