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
  return Boolean(font?.variable && settings.preferVariable);
}

function escapeQuoted(value: string): string {
  return value.replace(/[\\']/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

function encodeFamilyParam(family: string): string {
  return family
    .trim()
    .split(/\s+/)
    .map((part) => encodeURIComponent(part))
    .join('+');
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
  return `font-family: '${escapeQuoted(familyName)}', ${fallback};`;
}

export function buildFamilyParam(
  familyName: string,
  catalogFont?: CatalogFont,
): string {
  const encoded = encodeFamilyParam(familyName);
  if (
    catalogFont?.variable &&
    catalogFont.weights &&
    catalogFont.weights.length > 1
  ) {
    const min = Math.min(...catalogFont.weights);
    const max = Math.max(...catalogFont.weights);
    if (min < max) {
      return `family=${encoded}:wght@${min}..${max}`;
    }
  }
  const weights =
    catalogFont?.weights && catalogFont.weights.length > 0
      ? catalogFont.weights.join(';')
      : '400;700';
  return `family=${encoded}:wght@${weights}`;
}

function buildFamilyQueryParam(
  fav: Favorite,
  settings: Settings,
  catalog?: CatalogFont[],
): string {
  const encodedName = encodeFamilyParam(fav.family);
  const isVar = isFontVariable(fav, settings, catalog);

  if (isVar) {
    const font = catalog?.find((f) => f.id === fav.id);
    if (font?.weights && font.weights.length > 1) {
      const min = Math.min(...font.weights);
      const max = Math.max(...font.weights);
      if (min < max) {
        return `family=${encodedName}:wght@${min}..${max}`;
      }
    }
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

export function toNextFontFunctionName(family: string): string {
  return family.replace(/[^a-zA-Z0-9]/g, '_');
}

export function toCamelCase(str: string): string {
  const cleaned = str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^([A-Z])/, (_, chr) => chr.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  return cleaned || 'font';
}

export function buildTailwindV4Snippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const declarations = context.favorites.map((fav) => {
    const isVar = isFontVariable(fav, context.settings, context.catalog);
    const font = context.catalog?.find((f) => f.id === fav.id);
    const familyName = isVar ? `${fav.family} Variable` : fav.family;
    const fallback = getCategoryFallback(font?.category);
    return `  --font-${fav.id}: '${escapeQuoted(familyName)}', ${fallback};`;
  });

  return `@theme {\n${declarations.join('\n')}\n}`;
}

export function buildTailwindV3Snippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const entries = context.favorites.map((fav) => {
    const isVar = isFontVariable(fav, context.settings, context.catalog);
    const font = context.catalog?.find((f) => f.id === fav.id);
    const familyName = isVar ? `${fav.family} Variable` : fav.family;
    const fallback = getCategoryFallback(font?.category);
    return `      '${escapeQuoted(fav.id)}': ['"${escapeQuoted(familyName)}"', '${fallback}'],`;
  });

  return [
    '// tailwind.config.js',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      fontFamily: {',
    entries.join('\n'),
    '      },',
    '    },',
    '  },',
    '};',
  ].join('\n');
}

export function buildNextFontSnippet(context: SnippetContext): string {
  if (context.favorites.length === 0) return '';

  const fnNames = context.favorites.map((fav) =>
    toNextFontFunctionName(fav.family),
  );
  const uniqueFnNames = Array.from(new Set(fnNames));
  const importLine = `import { ${uniqueFnNames.join(', ')} } from 'next/font/google';`;
  const display = context.settings.display || 'swap';

  const instances = context.favorites.map((fav) => {
    const fnName = toNextFontFunctionName(fav.family);
    const varName = toCamelCase(fav.family);
    const font = context.catalog?.find((f) => f.id === fav.id);
    const isVar = isFontVariable(fav, context.settings, context.catalog);

    const subset = font?.subsets?.includes('latin')
      ? 'latin'
      : (font?.subsets?.[0] ?? 'latin');

    if (isVar) {
      return `export const ${varName} = ${fnName}({\n  subsets: ['${subset}'],\n  display: '${display}',\n});`;
    }

    const weights = resolveFontWeights(font, context.settings.defaultWeights);
    const weightStrs = weights.map((w) => `'${w}'`).join(', ');
    return `export const ${varName} = ${fnName}({\n  weight: [${weightStrs}],\n  subsets: ['${subset}'],\n  display: '${display}',\n});`;
  });

  return `${importLine}\n\n${instances.join('\n\n')}`;
}

export function buildSnippet(context: SnippetContext): string {
  switch (context.settings.copyFormat) {
    case 'google-link':
      return buildGoogleLinkSnippet(context);
    case 'google-import':
      return buildGoogleImportSnippet(context);
    case 'fontsource':
      return buildFontsourceSnippet(context);
    case 'tailwind-v4':
      return buildTailwindV4Snippet(context);
    case 'tailwind-v3':
      return buildTailwindV3Snippet(context);
    case 'next-font':
      return buildNextFontSnippet(context);
    default:
      return buildGoogleLinkSnippet(context);
  }
}
