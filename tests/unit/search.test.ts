import { describe, expect, it } from 'vitest';
import { filterFavorites, sortFavorites } from '../../src/core/search';
import type { CatalogFont, Favorite, Tag } from '../../src/core/types';

describe('search core', () => {
  const mockCatalog: CatalogFont[] = [
    {
      id: 'inter',
      family: 'Inter',
      category: 'sans-serif',
      variable: true,
      subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
      weights: [100, 400, 900],
      styles: ['normal'],
    },
    {
      id: 'roboto',
      family: 'Roboto',
      category: 'sans-serif',
      variable: false,
      subsets: ['latin', 'cyrillic'],
      weights: [400, 700],
      styles: ['normal'],
    },
    {
      id: 'playfair',
      family: 'Playfair Display',
      category: 'serif',
      variable: true,
      subsets: ['latin', 'vietnamese'],
      weights: [400, 700],
      styles: ['normal'],
    },
    {
      id: 'fira-code',
      family: 'Fira Code',
      category: 'monospace',
      variable: true,
      subsets: ['latin'],
      weights: [400],
      styles: ['normal'],
    },
  ];

  const tags: Tag[] = [
    { id: 'ui', name: 'UI', color: '#111' },
    { id: 'heading', name: 'Heading', color: '#222' },
  ];

  const favorites: Favorite[] = [
    { id: 'inter', family: 'Inter', addedAt: 1000, tags: ['ui'] },
    { id: 'roboto', family: 'Roboto', addedAt: 900, tags: [] },
    {
      id: 'playfair',
      family: 'Playfair Display',
      addedAt: 800,
      tags: ['heading'],
    },
    { id: 'fira-code', family: 'Fira Code', addedAt: 700, tags: ['ui'] },
  ];

  it('filters by variable fonts only', () => {
    const result = filterFavorites(favorites, mockCatalog, tags, {
      variableOnly: true,
    });
    expect(result.map((f) => f.id)).toEqual(['inter', 'playfair', 'fira-code']);
  });

  it('filters by category', () => {
    const result = filterFavorites(favorites, mockCatalog, tags, {
      category: 'serif',
    });
    expect(result.map((f) => f.id)).toEqual(['playfair']);
  });

  it('filters by subsets', () => {
    const cyrillicFonts = filterFavorites(favorites, mockCatalog, tags, {
      subsets: ['cyrillic'],
    });
    expect(cyrillicFonts.map((f) => f.id)).toEqual(['inter', 'roboto']);

    const greekAndCyrillic = filterFavorites(favorites, mockCatalog, tags, {
      subsets: ['cyrillic', 'greek'],
    });
    expect(greekAndCyrillic.map((f) => f.id)).toEqual(['inter']);
  });

  it('filters by custom tags', () => {
    const uiFonts = filterFavorites(favorites, mockCatalog, tags, {
      tagIds: ['ui'],
    });
    expect(uiFonts.map((f) => f.id)).toEqual(['inter', 'fira-code']);
  });

  it('combines category, variable, subset, and tag filters (AND logic)', () => {
    const combined = filterFavorites(favorites, mockCatalog, tags, {
      category: 'sans-serif',
      variableOnly: true,
      subsets: ['cyrillic'],
      tagIds: ['ui'],
    });
    expect(combined.map((f) => f.id)).toEqual(['inter']);
  });

  it('searches across family name, custom tags, category, subsets, and "variable"', () => {
    expect(
      filterFavorites(favorites, mockCatalog, tags, { query: 'play' }).map(
        (f) => f.id,
      ),
    ).toEqual(['playfair']);

    expect(
      filterFavorites(favorites, mockCatalog, tags, { query: 'head' }).map(
        (f) => f.id,
      ),
    ).toEqual(['playfair']);

    expect(
      filterFavorites(favorites, mockCatalog, tags, { query: 'mono' }).map(
        (f) => f.id,
      ),
    ).toEqual(['fira-code']);

    expect(
      filterFavorites(favorites, mockCatalog, tags, {
        query: 'vietnamese',
      }).map((f) => f.id),
    ).toEqual(['playfair']);

    expect(
      filterFavorites(favorites, mockCatalog, tags, { query: 'variable' }).map(
        (f) => f.id,
      ),
    ).toEqual(['inter', 'playfair', 'fira-code']);
  });

  it('matches query in favorite note', () => {
    const favsWithNote: Favorite[] = [
      ...favorites,
      {
        id: 'inter',
        family: 'Inter',
        addedAt: 1000,
        tags: [],
        note: 'Primary brand typeface for dashboard',
      },
    ];

    const results = filterFavorites(favsWithNote, mockCatalog, tags, {
      query: 'dashboard',
    });
    expect(results.map((f) => f.id)).toEqual(['inter']);
  });

  describe('sortFavorites', () => {
    it('sorts by newest first (descending addedAt)', () => {
      const sorted = sortFavorites(favorites, mockCatalog, 'newest');
      expect(sorted.map((f) => f.id)).toEqual([
        'inter',
        'roboto',
        'playfair',
        'fira-code',
      ]);
    });

    it('sorts by oldest first (ascending addedAt)', () => {
      const sorted = sortFavorites(favorites, mockCatalog, 'oldest');
      expect(sorted.map((f) => f.id)).toEqual([
        'fira-code',
        'playfair',
        'roboto',
        'inter',
      ]);
    });

    it('sorts alphabetically A-Z and Z-A', () => {
      const asc = sortFavorites(favorites, mockCatalog, 'alpha-asc');
      expect(asc.map((f) => f.family)).toEqual([
        'Fira Code',
        'Inter',
        'Playfair Display',
        'Roboto',
      ]);

      const desc = sortFavorites(favorites, mockCatalog, 'alpha-desc');
      expect(desc.map((f) => f.family)).toEqual([
        'Roboto',
        'Playfair Display',
        'Inter',
        'Fira Code',
      ]);
    });

    it('sorts by catalog category', () => {
      const sorted = sortFavorites(favorites, mockCatalog, 'category');
      expect(sorted.map((f) => f.id)).toEqual([
        'fira-code',
        'inter',
        'roboto',
        'playfair',
      ]);
    });
  });
});
