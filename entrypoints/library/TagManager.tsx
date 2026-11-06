import { useEffect, useRef, useState } from 'react';
import { DEFAULT_TAG_COLORS, validateTagName } from '../../src/core/tags';
import type { Favorite, Tag } from '../../src/core/types';
import { createTag, deleteTag, updateTag } from '../../src/storage/items';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  favorites: Favorite[];
  onTagDeleted: (tagId: string) => void;
}

export default function TagManager({
  isOpen,
  onClose,
  tags,
  favorites,
  onTagDeleted,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(
    DEFAULT_TAG_COLORS[6] ?? '#3b82f6',
  );
  const [tagError, setTagError] = useState<string | null>(null);

  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tagToDelete) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tagToDelete, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => newTagInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateTagName(newTagName, tags);
    if (!validation.valid) {
      setTagError(validation.error ?? 'Invalid tag name.');
      return;
    }
    setTagError(null);
    try {
      await createTag(newTagName, newTagColor);
      setNewTagName('');
      setNewTagColor(DEFAULT_TAG_COLORS[0] ?? '#64748b');
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to create tag.');
    }
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditError(null);
  };

  const cancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('');
    setEditError(null);
  };

  const handleSaveEditTag = async (tagId: string) => {
    const validation = validateTagName(editTagName, tags, tagId);
    if (!validation.valid) {
      setEditError(validation.error ?? 'Invalid tag name.');
      return;
    }
    setEditError(null);
    try {
      await updateTag(tagId, { name: editTagName, color: editTagColor });
      cancelEditTag();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update tag.',
      );
    }
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagToDelete) return;
    const idToDelete = tagToDelete.id;
    try {
      await deleteTag(idToDelete);
      onTagDeleted(idToDelete);
      setTagToDelete(null);
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const getTagUsageCount = (tagId: string) => {
    return favorites.filter((f) => f.tags?.includes(tagId)).length;
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-manager-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      >
        <div className="flex flex-col w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-zinc-600 fill-none stroke-current"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <h2
                id="tag-manager-title"
                className="text-lg font-bold text-zinc-900"
              >
                Manage Custom Tags
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-6">
            <form onSubmit={handleCreateTag} className="space-y-3">
              <label
                htmlFor="new-tag-name"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Create New Tag
              </label>
              <div className="flex gap-2">
                <input
                  ref={newTagInputRef}
                  id="new-tag-name"
                  type="text"
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    if (tagError) setTagError(null);
                  }}
                  placeholder="e.g. Headlines, Playful, Client A"
                  maxLength={32}
                  className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer transition-colors shrink-0"
                >
                  Add Tag
                </button>
              </div>

              <div>
                <div className="text-xs text-zinc-500 mb-1.5">Tag Color:</div>
                <div className="flex flex-wrap items-center gap-2">
                  {DEFAULT_TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTagColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform flex items-center justify-center ${
                        newTagColor === color
                          ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      aria-label={`Select color ${color}`}
                    >
                      {newTagColor === color && (
                        <span className="text-[10px] text-white font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-200 pl-3">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-6 h-6 rounded-md cursor-pointer border-0 bg-transparent p-0"
                      title="Custom hex color"
                    />
                    <span className="text-xs text-zinc-500 font-mono">
                      {newTagColor}
                    </span>
                  </div>
                </div>
              </div>

              {tagError && (
                <p className="text-xs text-red-600 font-medium">{tagError}</p>
              )}
            </form>

            <div className="border-t border-zinc-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Existing Tags ({tags.length})
                </h3>
              </div>

              {tags.length === 0 ? (
                <p className="text-sm text-zinc-400 italic py-4 text-center">
                  No custom tags created yet.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
                  {tags.map((tag) => {
                    const isEditing = editingTagId === tag.id;
                    const usageCount = getTagUsageCount(tag.id);

                    return (
                      <div
                        key={tag.id}
                        className="flex flex-col gap-2 p-3 bg-white"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editTagName}
                                onChange={(e) => setEditTagName(e.target.value)}
                                maxLength={32}
                                className="flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveEditTag(tag.id)}
                                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditTag}
                                className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {DEFAULT_TAG_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setEditTagColor(color)}
                                  style={{ backgroundColor: color }}
                                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                                    editTagColor === color
                                      ? 'ring-2 ring-offset-1 ring-zinc-900 scale-110'
                                      : 'hover:scale-105'
                                  }`}
                                />
                              ))}
                              <input
                                type="color"
                                value={editTagColor}
                                onChange={(e) =>
                                  setEditTagColor(e.target.value)
                                }
                                className="w-5 h-5 rounded-md cursor-pointer border-0 bg-transparent p-0 ml-1.5"
                                title="Custom color"
                              />
                            </div>

                            {editError && (
                              <p className="text-xs text-red-600 font-medium">
                                {editError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="text-sm font-semibold text-zinc-800">
                                {tag.name}
                              </span>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                                {usageCount} font
                                {usageCount === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditTag(tag)}
                                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer transition-colors"
                                title="Edit tag"
                              >
                                <svg
                                  className="w-4 h-4 fill-none stroke-current"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTagToDelete(tag)}
                                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors"
                                title="Delete tag"
                              >
                                <svg
                                  className="w-4 h-4 fill-none stroke-current"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-3.5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {tagToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-zinc-200">
            <h4 className="text-base font-bold text-zinc-900 mb-2">
              Delete Tag?
            </h4>
            <p className="text-sm text-zinc-600 mb-4 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-zinc-900">"{tagToDelete.name}"</strong>?
              {getTagUsageCount(tagToDelete.id) > 0 ? (
                <>
                  {' '}
                  It will be removed from{' '}
                  <span className="font-semibold text-zinc-900">
                    {getTagUsageCount(tagToDelete.id)} favorite font
                    {getTagUsageCount(tagToDelete.id) === 1 ? '' : 's'}
                  </span>
                  .
                </>
              ) : (
                ' This tag is not assigned to any fonts.'
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTagToDelete(null)}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteTag()}
                className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
