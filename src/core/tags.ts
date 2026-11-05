import type { Favorite, Tag } from './types';

export const DEFAULT_TAG_COLORS = [
  '#64748b',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
];

export function validateTagName(
  name: string,
  existingTags: Tag[],
  currentTagId?: string,
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Tag name cannot be empty.' };
  }
  if (trimmed.length > 32) {
    return { valid: false, error: 'Tag name must be 32 characters or less.' };
  }
  const normalized = trimmed.toLowerCase();
  const duplicate = existingTags.some(
    (tag) => tag.id !== currentTagId && tag.name.toLowerCase() === normalized,
  );
  if (duplicate) {
    return { valid: false, error: 'A tag with this name already exists.' };
  }
  return { valid: true };
}

export function createTagRecord(name: string, color?: string): Tag {
  const trimmed = name.trim();
  const id = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const chosenColor =
    color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
      ? color
      : DEFAULT_TAG_COLORS[0] || '#64748b';
  return {
    id,
    name: trimmed,
    color: chosenColor,
  };
}

export function updateTagRecord(
  tags: Tag[],
  tagId: string,
  updates: Partial<Pick<Tag, 'name' | 'color'>>,
): Tag[] {
  return tags.map((tag) => {
    if (tag.id !== tagId) return tag;
    return {
      ...tag,
      name: updates.name !== undefined ? updates.name.trim() : tag.name,
      color:
        updates.color !== undefined &&
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(updates.color)
          ? updates.color
          : tag.color,
    };
  });
}

export function deleteTagRecord(tags: Tag[], tagId: string): Tag[] {
  return tags.filter((tag) => tag.id !== tagId);
}

export function toggleFavoriteTagId(
  favorite: Favorite,
  tagId: string,
): Favorite {
  const hasTag = favorite.tags.includes(tagId);
  const nextTags = hasTag
    ? favorite.tags.filter((id) => id !== tagId)
    : [...favorite.tags, tagId];
  return {
    ...favorite,
    tags: nextTags,
  };
}

export function removeTagFromAllFavorites(
  favorites: Favorite[],
  deletedTagId: string,
): Favorite[] {
  return favorites.map((fav) => {
    if (!fav.tags.includes(deletedTagId)) return fav;
    return {
      ...fav,
      tags: fav.tags.filter((id) => id !== deletedTagId),
    };
  });
}
