import { storage } from '@wxt-dev/storage';
import type { Catalog, Favorite, Settings, Tag } from '../core/types';
import { STORAGE_VERSION } from './migrations';

export const defaultSettings: Settings = {
  copyFormat: 'google-link',
  packageManager: 'pnpm',
  preferVariable: true,
  defaultWeights: [400, 700],
  display: 'swap',
};

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  defaultValue: defaultSettings,
  version: STORAGE_VERSION,
});

export const tagsItem = storage.defineItem<Tag[]>('sync:tags', {
  defaultValue: [],
  version: STORAGE_VERSION,
});

export const catalogItem = storage.defineItem<Catalog | null>('local:catalog', {
  defaultValue: null,
  version: STORAGE_VERSION,
});

export function getFavoriteKey(fontId: string): `sync:fav:${string}` {
  return `sync:fav:${fontId}`;
}

export function defineFavoriteItem(fontId: string) {
  return storage.defineItem<Favorite | null>(getFavoriteKey(fontId), {
    defaultValue: null,
    version: STORAGE_VERSION,
  });
}
