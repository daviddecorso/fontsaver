import type { CatalogFont, Favorite, Settings } from './types';

export interface SnippetContext {
  favorites: Favorite[];
  settings: Settings;
  catalog?: CatalogFont[];
}

export function getCategoryFallback(category?: string): string {
  if (!category) return 'sans-serif';
  const cat = category.toLowerCase().trim();
  if (cat === 'handwriting') return 'cursive';
  if (cat === 'serif') return 'serif';
  if (cat === 'monospace') return 'monospace';
  if (cat === 'cursive') return 'cursive';
  return 'sans-serif';
}

export function resolveFontWeights(
  catalogFont?: CatalogFont,
  defaultWeights?: number[],
): number[] {
  const preferred =
    defaultWeights && defaultWeights.length > 0 ? defaultWeights : [400];
  if (!catalogFont?.weights || catalogFont.weights.length === 0) {
    return [...preferred].sort((a, b) => a - b);
  }

  const intersected = preferred
    .filter((w) => catalogFont.weights.includes(w))
    .sort((a, b) => a - b);

  if (intersected.length > 0) {
    return intersected;
  }

  if (catalogFont.weights.includes(400)) {
    return [400];
  }

  const sorted = [...catalogFont.weights].sort((a, b) => a - b);
  return sorted[0] !== undefined ? [sorted[0]] : [400];
}

export function isFontVariable(
  fav: Favorite,
  settings: Settings,
  catalog?: CatalogFont[],
): boolean {
  const font = catalog?.find((f) => f.id === fav.id);
  if (font) {
    return Boolean(font.variable && settings.preferVariable);
  }
  return Boolean(settings.preferVariable);
}

export function buildFontFamilyRule(
  fav: Favorite,
  isFontsourceVariable: boolean,
  catalog?: CatalogFont[],
): string {
  const font = catalog?.find((f) => f.id === fav.id);
  const familyName = isFontsourceVariable
    ? `${fav.family} Variable`
    : fav.family;
  const fallback = getCategoryFallback(font?.category);
  return `font-family: '${familyName}', ${fallback};`;
}

function buildFamilyQueryParam(
  fav: Favorite,
  settings: Settings,
  catalog?: CatalogFont[],
): string {
  const encodedName = fav.family.replace(/\s+/g, '+');
  const isVar = isFontVariable(fav, settings, catalog);

  if (isVar) {
    return `family=${encodedName}:wght@100..900`;
  }

  const font = catalog?.find((f) => f.id === fav.id);
  const weights = resolveFontWeights(font, settings.defaultWeights);
  return `family=${encodedName}:wght@${weights.join(';')}`;
}

export function buildGoogleLinkSnippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const families = context.favorites
    .map((fav) => buildFamilyQueryParam(fav, context.settings, context.catalog))
    .join('&');
  const display = context.settings.display || 'swap';

  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="https://fonts.googleapis.com/css2?${families}&display=${display}" rel="stylesheet">`,
  ].join('\n');
}

export function buildGoogleImportSnippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const families = context.favorites
    .map((fav) => buildFamilyQueryParam(fav, context.settings, context.catalog))
    .join('&');
  const display = context.settings.display || 'swap';
  const importRule = `@import url('https://fonts.googleapis.com/css2?${families}&display=${display}');`;
  const cssRules = context.favorites
    .map((fav) => buildFontFamilyRule(fav, false, context.catalog))
    .join('\n');

  return `${importRule}\n\n${cssRules}`;
}

export function buildFontsourceSnippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const pm = context.settings.packageManager || 'pnpm';
  const pkgNames: string[] = [];
  const importStatements: string[] = [];
  const cssRules: string[] = [];

  for (const fav of context.favorites) {
    const isVar = isFontVariable(fav, context.settings, context.catalog);
    const font = context.catalog?.find((f) => f.id === fav.id);

    if (isVar) {
      pkgNames.push(`@fontsource-variable/${fav.id}`);
      importStatements.push(`import '@fontsource-variable/${fav.id}';`);
    } else {
      pkgNames.push(`@fontsource/${fav.id}`);
      const weights = resolveFontWeights(font, context.settings.defaultWeights);
      for (const weight of weights) {
        importStatements.push(`import '@fontsource/${fav.id}/${weight}.css';`);
      }
    }

    cssRules.push(buildFontFamilyRule(fav, isVar, context.catalog));
  }

  const installCommand = `${pm} add ${pkgNames.join(' ')}`;
  return `${installCommand}\n\n${importStatements.join('\n')}\n\n${cssRules.join('\n')}`;
}

export function buildSnippet(context: SnippetContext): string {
  switch (context.settings.copyFormat) {
    case 'google-link':
      return buildGoogleLinkSnippet(context);
    case 'google-import':
      return buildGoogleImportSnippet(context);
    case 'fontsource':
      return buildFontsourceSnippet(context);
    default:
      return buildGoogleLinkSnippet(context);
  }
}
