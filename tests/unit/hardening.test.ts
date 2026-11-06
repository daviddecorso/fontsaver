import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  ensureCatalogPopulated,
  handleContextMenuClick,
  MENU_FAVORITE_SPECIMEN,
} from '../../entrypoints/background';
import { validateExportData } from '../../src/core/export-import';
import { specimenUrl } from '../../src/core/family-id';
import {
  buildFamilyParam,
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
  buildTailwindV3Snippet,
  isFontVariable,
} from '../../src/core/snippets';
import type { Favorite, Settings } from '../../src/core/types';
import {
  catalogItem,
  defaultSettings,
  defineFavoriteItem,
  getAllFavorites,
  importLibraryData,
  migrateStorageMode,
  settingsItem,
} from '../../src/storage/items';

const fav = (id: string, family: string, extra: Partial<Favorite> = {}) => ({
  id,
  family,
  addedAt: 1000,
  tags: [],
  ...extra,
});

describe('import validation', () => {
  it('rejects backups from a newer version', () => {
    const result = validateExportData({ version: 99, favorites: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects unsafe ids and control characters', () => {
    expect(
      validateExportData({
        version: 1,
        favorites: [fav("x'; alert(1)", 'Bad')],
      }).valid,
    ).toBe(false);
    expect(
      validateExportData({ version: 1, favorites: [fav('ok', 'Bad\nName')] })
        .valid,
    ).toBe(false);
  });

  it('drops invalid settings and keeps valid ones', () => {
    const result = validateExportData({
      version: 1,
      favorites: [],
      settings: {
        copyFormat: 'nope',
        defaultWeights: 'x',
        display: 'swap',
        preferVariable: false,
        storageMode: 'local',
      },
    });
    expect(result.valid && result.data.settings).toEqual({
      display: 'swap',
      preferVariable: false,
    });
  });

  it('normalises favorites and tags', () => {
    const result = validateExportData({
      version: 1,
      favorites: [
        { id: 'a', family: ' A ', tags: ['t1', 5, 't1'], addedAt: 'x' },
      ],
      tags: [{ id: 't1', name: 'Tag', color: 'javascript:1' }],
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.favorites[0]?.family).toBe('A');
    expect(result.data.favorites[0]?.tags).toEqual(['t1']);
    expect(typeof result.data.favorites[0]?.addedAt).toBe('number');
    expect(result.data.tags[0]?.color).toBe('#64748b');
  });
});

describe('snippet safety', () => {
  const settings: Settings = { ...defaultSettings, preferVariable: true };

  it('treats fonts missing from the catalog as non-variable', () => {
    expect(isFontVariable(fav('x', 'X'), settings, [])).toBe(false);
    expect(isFontVariable(fav('x', 'X'), settings, undefined)).toBe(false);
    const link = buildGoogleLinkSnippet({
      favorites: [fav('x', 'X')],
      settings,
    });
    expect(link).toContain('family=X:wght@400;700');
    expect(
      buildFontsourceSnippet({ favorites: [fav('x', 'X')], settings }),
    ).toContain('@fontsource/x');
  });

  it('escapes quotes in generated CSS and JS', () => {
    const evil = fav('evil', "Evil' } body { x: y");
    expect(buildGoogleImportSnippet({ favorites: [evil], settings })).toContain(
      "font-family: 'Evil\\' } body { x: y'",
    );
    expect(buildTailwindV3Snippet({ favorites: [evil], settings })).toContain(
      "Evil\\' } body",
    );
  });

  it('url-encodes family names', () => {
    expect(buildFamilyParam('A&B Sans')).toBe('family=A%26B+Sans:wght@400;700');
    expect(specimenUrl('Open Sans')).toBe(
      'https://fonts.google.com/specimen/Open+Sans',
    );
  });
});

describe('storage safety', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('keeps existing favorites when a replace import would exceed sync quota', async () => {
    await defineFavoriteItem('inter', 'sync').setValue(fav('inter', 'Inter'));

    const tooMany = Array.from({ length: 600 }, (_, i) =>
      fav(`f${i}`, `F${i}`),
    );
    await expect(
      importLibraryData({ version: 1, favorites: tooMany }, 'replace'),
    ).rejects.toThrow(/sync storage limit/);

    const remaining = await getAllFavorites('sync');
    expect(remaining.map((f) => f.id)).toEqual(['inter']);
  });

  it('removes only stale favorites on replace import', async () => {
    await defineFavoriteItem('old', 'sync').setValue(fav('old', 'Old'));
    await defineFavoriteItem('kept', 'sync').setValue(fav('kept', 'Kept'));

    await importLibraryData(
      { version: 1, favorites: [fav('kept', 'Kept'), fav('new', 'New')] },
      'replace',
    );

    const ids = (await getAllFavorites('sync')).map((f) => f.id).sort();
    expect(ids).toEqual(['kept', 'new']);
  });

  it('removes source copies after migrating storage mode', async () => {
    await defineFavoriteItem('inter', 'sync').setValue(fav('inter', 'Inter'));

    await migrateStorageMode('local');
    expect(await getAllFavorites('sync')).toHaveLength(0);
    expect(await getAllFavorites('local')).toHaveLength(1);

    await migrateStorageMode('sync');
    expect(await getAllFavorites('local')).toHaveLength(0);
    expect(await getAllFavorites('sync')).toHaveLength(1);
    expect((await settingsItem.getValue()).storageMode).toBe('sync');
  });

  it('refuses to migrate into sync when it would not fit', async () => {
    for (let i = 0; i < 520; i += 1) {
      await defineFavoriteItem(`f${i}`, 'local').setValue(
        fav(`f${i}`, `F${i}`),
      );
    }
    await settingsItem.setValue({ ...defaultSettings, storageMode: 'local' });

    await expect(migrateStorageMode('sync')).rejects.toThrow(
      /sync storage limit/,
    );
    expect(await getAllFavorites('local')).toHaveLength(520);
    expect(await getAllFavorites('sync')).toHaveLength(0);
  });
});

describe('background', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('does not overwrite an existing favorite from the context menu', async () => {
    await defineFavoriteItem('open-sans', 'sync').setValue(
      fav('open-sans', 'Open Sans', { tags: ['ui'], note: 'keep me' }),
    );

    const handled = await handleContextMenuClick({
      menuItemId: MENU_FAVORITE_SPECIMEN,
      linkUrl: 'https://fonts.google.com/specimen/Open+Sans',
    });

    expect(handled).toBe(true);
    const stored = await defineFavoriteItem('open-sans', 'sync').getValue();
    expect(stored?.tags).toEqual(['ui']);
    expect(stored?.note).toBe('keep me');
    expect(stored?.addedAt).toBe(1000);
  });

  it('ignores malformed specimen URLs from the context menu', async () => {
    const handled = await handleContextMenuClick({
      menuItemId: MENU_FAVORITE_SPECIMEN,
      linkUrl: 'https://fonts.google.com/specimen/%E0%A4%A',
    });
    expect(handled).toBe(true);
  });

  it('fetches the catalog on startup only when it is missing', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      statusText: 'OK',
      json: async () => [{ id: 'inter', family: 'Inter' }],
    })) as unknown as typeof fetch;

    expect(await ensureCatalogPopulated(fetchFn)).toBe(true);
    expect((await catalogItem.getValue())?.fonts[0]?.id).toBe('inter');

    expect(await ensureCatalogPopulated(fetchFn)).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('survives a failed startup catalog fetch', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = (async () => ({
      ok: false,
      statusText: 'down',
    })) as unknown as typeof fetch;

    expect(await ensureCatalogPopulated(failing)).toBe(false);
    spy.mockRestore();
  });
});
