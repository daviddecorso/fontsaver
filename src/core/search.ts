import type { CatalogFont, Favorite, FilterOptions, Tag } from './types';

export type { FilterOptions };

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

    if (filters.subsets && filters.subsets.length > 0) {
      const hasAllSubsets = filters.subsets.every((subset) =>
        fontInfo?.subsets?.includes(subset),
      );
      if (!hasAllSubsets) return false;
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
      const subsetMatch = fontInfo?.subsets?.some((s) =>
        s.toLowerCase().includes(query),
      );
      const variableMatch =
        (query === 'variable' || query === 'var') &&
        Boolean(fontInfo?.variable);

      return (
        familyMatch || tagMatch || categoryMatch || subsetMatch || variableMatch
      );
    }

    return true;
  });
}
