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
