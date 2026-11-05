import { describe, expect, it } from 'vitest';
import {
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
  buildSnippet,
  getCategoryFallback,
  resolveFontWeights,
} from '../../src/core/snippets';
import type { CatalogFont, Favorite, Settings } from '../../src/core/types';

describe('snippets', () => {
  const sampleFavorite: Favorite = {
    id: 'inter',
    family: 'Inter',
    addedAt: 1700000000000,
    tags: [],
  };

  const staticFavorite: Favorite = {
    id: 'roboto',
    family: 'Roboto',
    addedAt: 1700000000000,
    tags: [],
  };

  const handwritingFavorite: Favorite = {
    id: 'caveat',
    family: 'Caveat',
    addedAt: 1700000000000,
    tags: [],
  };

  const monospaceFavorite: Favorite = {
    id: 'fira-code',
    family: 'Fira Code',
    addedAt: 1700000000000,
    tags: [],
  };

  const serifFavorite: Favorite = {
    id: 'merriweather',
    family: 'Merriweather',
    addedAt: 1700000000000,
    tags: [],
  };

  const mockCatalog: CatalogFont[] = [
    {
      id: 'inter',
      family: 'Inter',
      category: 'sans-serif',
      variable: true,
      subsets: ['latin'],
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      styles: ['normal'],
    },
    {
      id: 'roboto',
      family: 'Roboto',
      category: 'sans-serif',
      variable: false,
      subsets: ['latin'],
      weights: [100, 300, 400, 500, 700, 900],
      styles: ['normal'],
    },
    {
      id: 'caveat',
      family: 'Caveat',
      category: 'handwriting',
      variable: true,
      subsets: ['latin'],
      weights: [400, 500, 600, 700],
      styles: ['normal'],
    },
    {
      id: 'fira-code',
      family: 'Fira Code',
      category: 'monospace',
      variable: true,
      subsets: ['latin'],
      weights: [300, 400, 500, 600, 700],
      styles: ['normal'],
    },
    {
      id: 'merriweather',
      family: 'Merriweather',
      category: 'serif',
      variable: false,
      subsets: ['latin'],
      weights: [300, 400, 700, 900],
      styles: ['normal'],
    },
  ];

  const sampleSettings: Settings = {
    copyFormat: 'google-link',
    packageManager: 'pnpm',
    preferVariable: true,
    defaultWeights: [400, 700],
    display: 'swap',
    storageMode: 'sync',
  };

  describe('category fallbacks and weight resolution helpers', () => {
    it('maps font categories to generic CSS fallbacks', () => {
      expect(getCategoryFallback('handwriting')).toBe('cursive');
      expect(getCategoryFallback('Handwriting ')).toBe('cursive');
      expect(getCategoryFallback('serif')).toBe('serif');
      expect(getCategoryFallback('monospace')).toBe('monospace');
      expect(getCategoryFallback('cursive')).toBe('cursive');
      expect(getCategoryFallback('sans-serif')).toBe('sans-serif');
      expect(getCategoryFallback('display')).toBe('sans-serif');
      expect(getCategoryFallback(undefined)).toBe('sans-serif');
    });

    it('intersects defaultWeights with catalog weights', () => {
      const font = mockCatalog.find((f) => f.id === 'roboto');
      expect(resolveFontWeights(font, [300, 700])).toEqual([300, 700]);
    });

    it('falls back to 400 or first available weight if intersection is empty', () => {
      const fontOnly400: CatalogFont = {
        id: 'test-400',
        family: 'Test 400',
        category: 'sans-serif',
        variable: false,
        subsets: ['latin'],
        weights: [400],
        styles: ['normal'],
      };
      expect(resolveFontWeights(fontOnly400, [300, 700])).toEqual([400]);

      const fontOnly300: CatalogFont = {
        id: 'test-300',
        family: 'Test 300',
        category: 'sans-serif',
        variable: false,
        subsets: ['latin'],
        weights: [300, 500],
        styles: ['normal'],
      };
      expect(resolveFontWeights(fontOnly300, [400, 700])).toEqual([300]);
    });
  });

  describe('buildGoogleLinkSnippet', () => {
    it('builds variable font link snippet', () => {
      const snippet = buildGoogleLinkSnippet({
        favorites: [sampleFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain('family=Inter:wght@100..900');
      expect(snippet).toContain('rel="stylesheet"');
    });

    it('builds static font link snippet with intersected weights', () => {
      const snippet = buildGoogleLinkSnippet({
        favorites: [staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain('family=Roboto:wght@400;700');
    });

    it('builds multi-font link snippet with variable and static fonts', () => {
      const snippet = buildGoogleLinkSnippet({
        favorites: [sampleFavorite, staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain(
        'family=Inter:wght@100..900&family=Roboto:wght@400;700',
      );
    });

    it('falls back to static weights if preferVariable is false', () => {
      const snippet = buildGoogleLinkSnippet({
        favorites: [sampleFavorite],
        settings: { ...sampleSettings, preferVariable: false },
        catalog: mockCatalog,
      });
      expect(snippet).toContain('family=Inter:wght@400;700');
    });

    it('returns empty string if no favorites', () => {
      const snippet = buildGoogleLinkSnippet({
        favorites: [],
        settings: sampleSettings,
      });
      expect(snippet).toBe('');
    });
  });

  describe('buildGoogleImportSnippet', () => {
    it('builds variable font @import snippet with CSS font-family rule', () => {
      const snippet = buildGoogleImportSnippet({
        favorites: [sampleFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain(
        "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');",
      );
      expect(snippet).toContain("font-family: 'Inter', sans-serif;");
    });

    it('builds static font @import snippet with intersected weights and CSS rule', () => {
      const snippet = buildGoogleImportSnippet({
        favorites: [staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain(
        "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');",
      );
      expect(snippet).toContain("font-family: 'Roboto', sans-serif;");
    });

    it('appends multiple font-family rules for multi-select', () => {
      const snippet = buildGoogleImportSnippet({
        favorites: [sampleFavorite, staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain("font-family: 'Inter', sans-serif;");
      expect(snippet).toContain("font-family: 'Roboto', sans-serif;");
    });
  });

  describe('buildFontsourceSnippet', () => {
    it('builds variable font snippet with @fontsource-variable package and Variable font name', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [sampleFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain('pnpm add @fontsource-variable/inter');
      expect(snippet).toContain("import '@fontsource-variable/inter';");
      expect(snippet).toContain("font-family: 'Inter Variable', sans-serif;");
    });

    it('builds static font snippet with @fontsource/<id>/<weight>.css imports', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain('pnpm add @fontsource/roboto');
      expect(snippet).toContain("import '@fontsource/roboto/400.css';");
      expect(snippet).toContain("import '@fontsource/roboto/700.css';");
      expect(snippet).toContain("font-family: 'Roboto', sans-serif;");
    });

    it('maps handwriting category to cursive fallback', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [handwritingFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain("font-family: 'Caveat Variable', cursive;");
    });

    it('maps monospace category to monospace fallback', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [monospaceFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain(
        "font-family: 'Fira Code Variable', monospace;",
      );
    });

    it('maps serif category to serif fallback', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [serifFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain("font-family: 'Merriweather', serif;");
    });

    it('handles multi-font selection with mixed variable and static fonts', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [sampleFavorite, staticFavorite],
        settings: sampleSettings,
        catalog: mockCatalog,
      });
      expect(snippet).toContain(
        'pnpm add @fontsource-variable/inter @fontsource/roboto',
      );
      expect(snippet).toContain("import '@fontsource-variable/inter';");
      expect(snippet).toContain("import '@fontsource/roboto/400.css';");
      expect(snippet).toContain("import '@fontsource/roboto/700.css';");
      expect(snippet).toContain("font-family: 'Inter Variable', sans-serif;");
      expect(snippet).toContain("font-family: 'Roboto', sans-serif;");
    });

    it('emits static package and weight imports if preferVariable is false', () => {
      const snippet = buildFontsourceSnippet({
        favorites: [sampleFavorite],
        settings: { ...sampleSettings, preferVariable: false },
        catalog: mockCatalog,
      });
      expect(snippet).toContain('pnpm add @fontsource/inter');
      expect(snippet).toContain("import '@fontsource/inter/400.css';");
      expect(snippet).toContain("import '@fontsource/inter/700.css';");
      expect(snippet).toContain("font-family: 'Inter', sans-serif;");
    });
  });

  describe('buildSnippet', () => {
    it('dispatches to chosen format', () => {
      const link = buildSnippet({
        favorites: [sampleFavorite],
        settings: { ...sampleSettings, copyFormat: 'google-link' },
        catalog: mockCatalog,
      });
      expect(link).toContain('<link');

      const importSnippet = buildSnippet({
        favorites: [sampleFavorite],
        settings: { ...sampleSettings, copyFormat: 'google-import' },
        catalog: mockCatalog,
      });
      expect(importSnippet).toContain('@import');

      const fontsource = buildSnippet({
        favorites: [sampleFavorite],
        settings: { ...sampleSettings, copyFormat: 'fontsource' },
        catalog: mockCatalog,
      });
      expect(fontsource).toContain('pnpm add');
    });
  });
});
