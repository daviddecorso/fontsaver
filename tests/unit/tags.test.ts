import { describe, expect, it } from 'vitest';
import {
  createTagRecord,
  DEFAULT_TAG_COLORS,
  deleteTagRecord,
  removeTagFromAllFavorites,
  toggleFavoriteTagId,
  updateTagRecord,
  validateTagName,
} from '../../src/core/tags';
import type { Favorite, Tag } from '../../src/core/types';

describe('tags core logic', () => {
  const existingTags: Tag[] = [
    { id: 'tag_1', name: 'Serif Picks', color: '#ef4444' },
    { id: 'tag_2', name: 'UI Fonts', color: '#3b82f6' },
  ];

  describe('validateTagName', () => {
    it('rejects empty or whitespace-only names', () => {
      expect(validateTagName('', existingTags).valid).toBe(false);
      expect(validateTagName('   ', existingTags).valid).toBe(false);
    });

    it('rejects names exceeding 32 characters', () => {
      const longName = 'a'.repeat(33);
      const res = validateTagName(longName, existingTags);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('32 characters');
    });

    it('rejects case-insensitive duplicate names', () => {
      expect(validateTagName('serif picks', existingTags).valid).toBe(false);
      expect(validateTagName('UI FONTS', existingTags).valid).toBe(false);
    });

    it('allows identical name if currentTagId matches (editing existing tag)', () => {
      expect(validateTagName('Serif Picks', existingTags, 'tag_1').valid).toBe(
        true,
      );
    });

    it('accepts valid distinct names', () => {
      expect(validateTagName('Display Headers', existingTags).valid).toBe(true);
    });
  });

  describe('createTagRecord', () => {
    it('creates tag with unique id, trimmed name, and given color', () => {
      const tag = createTagRecord('  Modern  ', '#10b981');
      expect(tag.name).toBe('Modern');
      expect(tag.color).toBe('#10b981');
      expect(tag.id).toMatch(/^tag_\d+_/);
    });

    it('falls back to default color on invalid color hex', () => {
      const tag = createTagRecord('Test', 'not-a-color');
      expect(tag.color).toBe(DEFAULT_TAG_COLORS[0]);
    });
  });

  describe('updateTagRecord', () => {
    it('updates name and color for matching tag', () => {
      const updated = updateTagRecord(existingTags, 'tag_1', {
        name: 'Editorial Serif',
        color: '#8b5cf6',
      });
      expect(updated[0]).toEqual({
        id: 'tag_1',
        name: 'Editorial Serif',
        color: '#8b5cf6',
      });
      expect(updated[1]).toEqual(existingTags[1]);
    });

    it('ignores non-matching tag ids', () => {
      const updated = updateTagRecord(existingTags, 'tag_nonexistent', {
        name: 'X',
      });
      expect(updated).toEqual(existingTags);
    });
  });

  describe('deleteTagRecord', () => {
    it('removes tag by id', () => {
      const updated = deleteTagRecord(existingTags, 'tag_1');
      expect(updated).toHaveLength(1);
      expect(updated[0]?.id).toBe('tag_2');
    });
  });

  describe('toggleFavoriteTagId', () => {
    const favorite: Favorite = {
      id: 'inter',
      family: 'Inter',
      addedAt: 123456,
      tags: ['tag_1'],
    };

    it('removes tag if already present', () => {
      const result = toggleFavoriteTagId(favorite, 'tag_1');
      expect(result.tags).toEqual([]);
    });

    it('adds tag if not present', () => {
      const result = toggleFavoriteTagId(favorite, 'tag_2');
      expect(result.tags).toEqual(['tag_1', 'tag_2']);
    });
  });

  describe('removeTagFromAllFavorites', () => {
    const favorites: Favorite[] = [
      { id: 'f1', family: 'Font 1', addedAt: 1, tags: ['tag_1', 'tag_2'] },
      { id: 'f2', family: 'Font 2', addedAt: 2, tags: ['tag_2'] },
      { id: 'f3', family: 'Font 3', addedAt: 3, tags: [] },
    ];

    it('removes deletedTagId from all favorites', () => {
      const updated = removeTagFromAllFavorites(favorites, 'tag_2');
      expect(updated[0]?.tags).toEqual(['tag_1']);
      expect(updated[1]?.tags).toEqual([]);
      expect(updated[2]?.tags).toEqual([]);
    });
  });
});
