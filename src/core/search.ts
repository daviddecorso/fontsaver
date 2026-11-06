import type {
  CatalogFont,
  Favorite,
  FilterOptions,
  SortOrder,
  Tag,
} from './types';

export type { FilterOptions, SortOrder };

export function sortFavorites(
  favorites: Favorite[],
  catalog: CatalogFont[] | undefined,
  sortBy: SortOrder = 'newest',
): Favorite[] {
  const catalogMap = new Map(catalog?.map((c) => [c.id, c]));
  const sorted = [...favorites];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => b.addedAt - a.addedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.addedAt - b.addedAt);
    case 'alpha-asc':
      return sorted.sort((a, b) => a.family.localeCompare(b.family));
    case 'alpha-desc':
      return sorted.sort((a, b) => b.family.localeCompare(a.family));
    case 'category':
      return sorted.sort((a, b) => {
        const catA = catalogMap.get(a.id)?.category ?? 'zz';
        const catB = catalogMap.get(b.id)?.category ?? 'zz';
        const diff = catA.localeCompare(catB);
        return diff !== 0 ? diff : a.family.localeCompare(b.family);
      });
    default:
      return sorted;
  }
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
      const noteMatch = fav.note
        ? fav.note.toLowerCase().includes(query)
        : false;
      const categoryMatch = fontInfo?.category.toLowerCase().includes(query);
      const subsetMatch = fontInfo?.subsets?.some((s) =>
        s.toLowerCase().includes(query),
      );
      const variableMatch =
        (query === 'variable' || query === 'var') &&
        Boolean(fontInfo?.variable);

      return (
        familyMatch ||
        tagMatch ||
        noteMatch ||
        categoryMatch ||
        subsetMatch ||
        variableMatch
      );
    }

    return true;
  });
}
