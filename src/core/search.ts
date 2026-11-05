import type { CatalogFont, Favorite, Tag } from './types';

export interface FilterOptions {
  query?: string;
  category?: string;
  variableOnly?: boolean;
  tagIds?: string[];
}

export function filterFavorites(
  favorites: Favorite[],
  catalog: CatalogFont[] | undefined,
  tags: Tag[],
  filters: FilterOptions,
): Favorite[] {
  const query = filters.query?.trim().toLowerCase();
  const catalogMap = new Map(catalog?.map((c) => [c.id, c]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name.toLowerCase()]));

  return favorites.filter((fav) => {
    const fontInfo = catalogMap.get(fav.id);

    if (filters.variableOnly && !fontInfo?.variable) {
      return false;
    }

    if (
      filters.category &&
      fontInfo?.category.toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      const hasAllTags = filters.tagIds.every((tagId) =>
        fav.tags.includes(tagId),
      );
      if (!hasAllTags) return false;
    }

    if (query) {
      const familyMatch = fav.family.toLowerCase().includes(query);
      const tagMatch = fav.tags.some((tagId) => {
        const name = tagMap.get(tagId);
        return name ? name.includes(query) : false;
      });
      const categoryMatch = fontInfo?.category.toLowerCase().includes(query);

      return familyMatch || tagMatch || categoryMatch;
    }

    return true;
  });
}
