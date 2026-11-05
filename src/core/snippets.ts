import type { CatalogFont, Favorite, Settings } from './types';

export interface SnippetContext {
  favorites: Favorite[];
  settings: Settings;
  catalog?: CatalogFont[];
}

export function buildGoogleLinkSnippet(context: SnippetContext): string {
  const families = context.favorites
    .map((fav) => `family=${fav.family.replace(/\s+/g, '+')}:wght@100..900`)
    .join('&');
  const display = context.settings.display || 'swap';

  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="https://fonts.googleapis.com/css2?${families}&display=${display}" rel="stylesheet">`,
  ].join('\n');
}

export function buildGoogleImportSnippet(context: SnippetContext): string {
  const families = context.favorites
    .map((fav) => `family=${fav.family.replace(/\s+/g, '+')}:wght@100..900`)
    .join('&');
  const display = context.settings.display || 'swap';

  return `@import url('https://fonts.googleapis.com/css2?${families}&display=${display}');`;
}

export function buildFontsourceSnippet(context: SnippetContext): string {
  const pm = context.settings.packageManager || 'pnpm';
  const pkgNames = context.favorites.map((fav) =>
    context.settings.preferVariable
      ? `@fontsource-variable/${fav.id}`
      : `@fontsource/${fav.id}`,
  );

  const installCommand = `${pm} add ${pkgNames.join(' ')}`;
  const importStatements = pkgNames.map((pkg) => `import '${pkg}';`).join('\n');

  return `${installCommand}\n\n${importStatements}`;
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
