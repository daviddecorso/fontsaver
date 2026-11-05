import type { CatalogFont } from './types';

export function slugifyFamily(family: string): string {
  return family
    .toLowerCase()
    .trim()
    .replace(/\+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractFamilyFromHref(href: string): string | null {
  if (!href) return null;
  const match = href.match(/\/specimen\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || null;
  } catch {
    return match[1].replace(/\+/g, ' ').trim() || null;
  }
}

export function familyNameToFontId(
  familyName: string,
  catalog?: CatalogFont[],
): string {
  if (catalog) {
    const match = catalog.find(
      (font) => font.family.toLowerCase() === familyName.toLowerCase(),
    );
    if (match) return match.id;
  }
  return slugifyFamily(familyName);
}
