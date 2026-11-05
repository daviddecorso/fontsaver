import { describe, expect, it } from 'vitest';
import {
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
} from '../../src/core/snippets';
import type { Favorite, Settings } from '../../src/core/types';

describe('snippets', () => {
  const sampleFavorite: Favorite = {
    id: 'inter',
    family: 'Inter',
    addedAt: Date.now(),
    tags: [],
  };

  const sampleSettings: Settings = {
    copyFormat: 'google-link',
    packageManager: 'pnpm',
    preferVariable: true,
    defaultWeights: [400, 700],
    display: 'swap',
  };

  it('builds google link snippet', () => {
    const snippet = buildGoogleLinkSnippet({
      favorites: [sampleFavorite],
      settings: sampleSettings,
    });
    expect(snippet).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(snippet).toContain('rel="stylesheet"');
  });

  it('builds google @import snippet', () => {
    const snippet = buildGoogleImportSnippet({
      favorites: [sampleFavorite],
      settings: sampleSettings,
    });
    expect(snippet).toContain('@import url(');
    expect(snippet).toContain('family=Inter');
  });

  it('builds fontsource snippet', () => {
    const snippet = buildFontsourceSnippet({
      favorites: [sampleFavorite],
      settings: sampleSettings,
    });
    expect(snippet).toContain('pnpm add @fontsource-variable/inter');
    expect(snippet).toContain("import '@fontsource-variable/inter';");
  });
});
