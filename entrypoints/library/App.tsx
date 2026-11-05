import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { filterFavorites } from '../../src/core/search';
import {
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
  buildSnippet,
  type SnippetContext,
} from '../../src/core/snippets';
import { DEFAULT_TAG_COLORS, validateTagName } from '../../src/core/tags';
import type {
  CatalogFont,
  CopyFormat,
  Favorite,
  Settings,
  StorageQuotaStats,
  Tag,
} from '../../src/core/types';
import {
  catalogItem,
  createTag,
  defaultSettings,
  deleteTag,
  exportLibraryData,
  getAllFavorites,
  getTags,
  migrateStorageMode,
  removeFavorite,
  settingsItem,
  toggleFavoriteTag,
  updateTag,
  watchFavorites,
  watchStorageQuota,
  watchTags,
} from '../../src/storage/items';

const CATEGORIES = [
  'all',
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
];

export default function App() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [catalog, setCatalog] = useState<CatalogFont[] | undefined>(undefined);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [variableOnly, setVariableOnly] = useState(false);
  const [selectedSubsets, setSelectedSubsets] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiCopyFormat, setMultiCopyFormat] =
    useState<CopyFormat>('google-link');
  const [previewText, setPreviewText] = useState(
    'The quick brown fox jumps over the lazy dog',
  );
  const [fontSize, setFontSize] = useState(32);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quota, setQuota] = useState<StorageQuotaStats | null>(null);
  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState(false);
  const [isMigratingStorage, setIsMigratingStorage] = useState(false);

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
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
  const [activeCardPopoverId, setActiveCardPopoverId] = useState<string | null>(
    null,
  );

  const newTagInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const loadedFamiliesRef = useRef<Set<string>>(new Set());
  const visibleFamiliesRef = useRef<Set<string>>(new Set());
  const scrollStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2500);
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getAllFavorites(),
      catalogItem.getValue(),
      settingsItem.getValue(),
      getTags(),
    ]).then(([favs, cat, sett, tg]) => {
      if (!isMounted) return;
      setFavorites(favs);
      if (cat?.fonts) setCatalog(cat.fonts);
      if (sett) {
        setSettings(sett);
        setMultiCopyFormat(sett.copyFormat);
      }
      if (tg) setTags(tg);
    });

    const unwatchFavs = watchFavorites((nextFavs) => {
      setFavorites(nextFavs);
    });

    const unwatchSettings = settingsItem.watch((nextSettings) => {
      if (nextSettings) {
        setSettings(nextSettings);
        setMultiCopyFormat(nextSettings.copyFormat);
      }
    });

    const unwatchTags = watchTags((nextTags) => {
      setTags(nextTags);
    });

    const unwatchQuota = watchStorageQuota((nextQuota) => {
      setQuota(nextQuota);
    });

    return () => {
      isMounted = false;
      unwatchFavs();
      unwatchSettings();
      unwatchTags();
      unwatchQuota();
    };
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-tag-popover]')) {
        setActiveCardPopoverId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCardPopoverId(null);
        if (isTagModalOpen && !tagToDelete) {
          setIsTagModalOpen(false);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTagModalOpen, tagToDelete]);

  useEffect(() => {
    if (isTagModalOpen) {
      setTimeout(() => {
        newTagInputRef.current?.focus();
      }, 50);
    }
  }, [isTagModalOpen]);

  const availableSubsets = useMemo(() => {
    if (!catalog || favorites.length === 0) return [];
    const catalogMap = new Map(catalog.map((c) => [c.id, c]));
    const subsetCounts = new Map<string, number>();

    for (const fav of favorites) {
      const info = catalogMap.get(fav.id);
      if (info?.subsets) {
        for (const s of info.subsets) {
          subsetCounts.set(s, (subsetCounts.get(s) ?? 0) + 1);
        }
      }
    }

    return Array.from(subsetCounts.keys()).sort((a, b) => {
      if (a === 'latin') return -1;
      if (b === 'latin') return 1;
      const diff = (subsetCounts.get(b) ?? 0) - (subsetCounts.get(a) ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }, [favorites, catalog]);

  const filtered = useMemo(() => {
    return filterFavorites(favorites, catalog, tags, {
      query,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      variableOnly: variableOnly || undefined,
      subsets: selectedSubsets.length > 0 ? selectedSubsets : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
  }, [
    favorites,
    catalog,
    tags,
    query,
    selectedCategory,
    variableOnly,
    selectedSubsets,
    selectedTagIds,
  ]);

  const flushBatchedFonts = useCallback(() => {
    const toLoad: string[] = [];
    for (const family of visibleFamiliesRef.current) {
      if (!loadedFamiliesRef.current.has(family)) {
        toLoad.push(family);
        loadedFamiliesRef.current.add(family);
      }
    }

    if (toLoad.length === 0) return;

    const CHUNK_SIZE = 10;
    for (let i = 0; i < toLoad.length; i += CHUNK_SIZE) {
      const chunk = toLoad.slice(i, i + CHUNK_SIZE);
      const families = chunk
        .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@400;700`)
        .join('&');
      const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-gff-preview-batch', 'true');
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      const families = filtered.slice(0, 20).map((f) => f.family);
      for (const f of families) visibleFamiliesRef.current.add(f);
      flushBatchedFonts();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let hasNew = false;
        for (const entry of entries) {
          const family = entry.target.getAttribute('data-family');
          if (!family) continue;

          if (entry.isIntersecting) {
            if (!visibleFamiliesRef.current.has(family)) {
              visibleFamiliesRef.current.add(family);
              hasNew = true;
            }
          }
        }

        if (hasNew) {
          if (scrollStopTimerRef.current) {
            clearTimeout(scrollStopTimerRef.current);
          }
          scrollStopTimerRef.current = setTimeout(() => {
            flushBatchedFonts();
          }, 150);
        }
      },
      {
        root: null,
        rootMargin: '120px 0px',
        threshold: 0.01,
      },
    );

    const cards =
      gridContainerRef.current?.querySelectorAll('[data-card-family]');
    if (cards) {
      for (const card of cards) {
        observer.observe(card);
      }
    }

    return () => {
      observer.disconnect();
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, [filtered, flushBatchedFonts]);

  const handleCopy = async (fav: Favorite, format?: string) => {
    const copyFormat = format ?? settings.copyFormat;
    const context: SnippetContext = {
      favorites: [fav],
      settings: {
        ...settings,
        copyFormat: copyFormat as Settings['copyFormat'],
      },
      catalog,
    };

    let snippet = '';
    if (copyFormat === 'google-import') {
      snippet = buildGoogleImportSnippet(context);
    } else if (copyFormat === 'fontsource') {
      snippet = buildFontsourceSnippet(context);
    } else {
      snippet = buildGoogleLinkSnippet(context);
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snippet);
    }

    setCopiedId(fav.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === fav.id ? null : curr));
    }, 1500);
  };

  const toggleSelect = (fontId: string) => {
    setSelectedIds((curr) =>
      curr.includes(fontId)
        ? curr.filter((id) => id !== fontId)
        : [...curr, fontId],
    );
  };

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((f) => selectedIds.includes(f.id));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((f) => f.id));
      setSelectedIds((curr) => curr.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filtered.map((f) => f.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const handleCopySelected = async () => {
    const selectedFavs = favorites.filter((f) => selectedIds.includes(f.id));
    if (selectedFavs.length === 0) return;

    const snippet = buildSnippet({
      favorites: selectedFavs,
      settings: {
        ...settings,
        copyFormat: multiCopyFormat,
      },
      catalog,
    });

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snippet);
    }

    showToast(
      `Copied combined snippet for ${selectedFavs.length} font${
        selectedFavs.length === 1 ? '' : 's'
      } (${multiCopyFormat})!`,
    );
  };

  const toggleSubset = (subset: string) => {
    setSelectedSubsets((curr) =>
      curr.includes(subset)
        ? curr.filter((s) => s !== subset)
        : [...curr, subset],
    );
  };

  const handleSwitchToLocal = async () => {
    setIsMigratingStorage(true);
    try {
      await migrateStorageMode('local');
      showToast('Switched to local storage (10 MB limit)');
    } catch {
      showToast('Failed to switch storage mode');
    } finally {
      setIsMigratingStorage(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const payload = await exportLibraryData();
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `google-fonts-favorites-${dateStr}.json`;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Library exported');
    } catch {
      showToast('Failed to export library');
    }
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((curr) =>
      curr.includes(tagId)
        ? curr.filter((id) => id !== tagId)
        : [...curr, tagId],
    );
  };

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
      setSelectedTagIds((curr) => curr.filter((id) => id !== idToDelete));
      setTagToDelete(null);
    } catch {
      // no-op
    }
  };

  const getTagUsageCount = (tagId: string) => {
    return favorites.filter((f) => f.tags?.includes(tagId)).length;
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-6 py-4 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-red-500 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <h1 className="text-xl font-bold tracking-tight">Font Library</h1>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {favorites.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTagModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-zinc-500 fill-none stroke-current"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span>Manage Tags</span>
              {tags.length > 0 && (
                <span className="ml-0.5 rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-600">
                  {tags.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (browser.runtime.openOptionsPage) {
                  void browser.runtime.openOptionsPage();
                } else {
                  void browser.tabs.create({
                    url: browser.runtime.getURL('/options.html'),
                  });
                }
              }}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() =>
                void browser.tabs.create({ url: 'https://fonts.google.com' })
              }
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Browse Google Fonts
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {toastMessage && (
          <div className="fixed bottom-24 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all">
            {toastMessage}
          </div>
        )}

        {settings.storageMode === 'sync' &&
          quota &&
          quota.isNearLimit &&
          !isQuotaBannerDismissed && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <span className="text-xs font-bold">
                    Sync Storage Warning ({quota.percentUsed}% used)
                  </span>
                  <p className="text-xs text-amber-800 mt-0.5">
                    You are nearing the 100 KB browser sync limit (
                    {(quota.bytesUsed / 1024).toFixed(1)} KB / 100 KB). Switch
                    to local storage to store unlimited fonts on this device.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isMigratingStorage}
                  onClick={() => void handleSwitchToLocal()}
                  className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 cursor-pointer disabled:opacity-50"
                >
                  {isMigratingStorage
                    ? 'Switching...'
                    : 'Switch to Local Storage'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportBackup()}
                  className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  Export Backup
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuotaBannerDismissed(true)}
                  className="rounded-lg p-1 text-amber-700 hover:text-amber-900 cursor-pointer"
                  aria-label="Dismiss banner"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
          <div>
            <label
              htmlFor="search-fonts"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
            >
              Search
            </label>
            <input
              id="search-fonts"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search family name or tags..."
              className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label
              htmlFor="preview-text"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
            >
              Preview Text
            </label>
            <input
              id="preview-text"
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Type sample text..."
              className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="font-size"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Font Size
              </label>
              <span className="text-xs text-zinc-500">{fontSize}px</span>
            </div>
            <input
              id="font-size"
              type="range"
              min={16}
              max={72}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">
            Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize cursor-pointer transition-colors ${
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}

          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-3 mr-1">
            Auto-Tags:
          </span>
          <button
            type="button"
            onClick={() => setVariableOnly((curr) => !curr)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors border ${
              variableOnly
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                variableOnly ? 'bg-white' : 'bg-indigo-500'
              }`}
            />
            <span>Variable Only</span>
          </button>

          {availableSubsets.length > 0 && (
            <>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-3 mr-1">
                Subsets:
              </span>
              {availableSubsets.map((subset) => {
                const isSelected = selectedSubsets.includes(subset);
                return (
                  <button
                    key={subset}
                    type="button"
                    onClick={() => toggleSubset(subset)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {subset}
                  </button>
                );
              })}
            </>
          )}

          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-3 mr-1">
            Tags:
          </span>
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTagFilter(tag.id)}
                style={
                  isSelected
                    ? {
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                        color: '#ffffff',
                      }
                    : undefined
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors border ${
                  isSelected
                    ? 'shadow-xs'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isSelected ? '#ffffff' : tag.color,
                  }}
                />
                <span>{tag.name}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsTagModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 cursor-pointer transition-colors"
          >
            <span>+</span>
            <span>Manage</span>
          </button>
        </div>

        {favorites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-16 text-center">
            <svg
              className="mx-auto w-12 h-12 text-zinc-300 stroke-current fill-none mb-3"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <h2 className="text-base font-semibold text-zinc-800">
              No favorites saved yet
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Browse Google Fonts and click the heart icon on any font card to
              add it to your collection.
            </p>
            <button
              type="button"
              onClick={() =>
                void browser.tabs.create({ url: 'https://fonts.google.com' })
              }
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Explore Fonts
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
            No fonts matched your search and filter criteria.
          </div>
        ) : (
          <div
            ref={gridContainerRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20"
          >
            {filtered.map((fav) => {
              const fontInfo = catalog?.find((c) => c.id === fav.id);
              const isSelected = selectedIds.includes(fav.id);
              return (
                <article
                  key={fav.id}
                  data-card-family="true"
                  data-family={fav.family}
                  className={`flex flex-col justify-between rounded-xl border bg-white p-5 shadow-2xs hover:shadow-sm transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-zinc-200'
                  }`}
                >
                  <header className="flex items-start justify-between border-b border-zinc-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(fav.id)}
                          aria-label={`Select ${fav.family}`}
                          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <h2 className="text-lg font-bold text-zinc-900">
                          {fav.family}
                        </h2>
                        {fontInfo?.category && (
                          <span className="rounded-xs bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 capitalize">
                            {fontInfo.category}
                          </span>
                        )}
                        {fontInfo?.variable && (
                          <span className="rounded-xs bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            Variable
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://fonts.google.com/specimen/${encodeURIComponent(
                          fav.family.replace(/\s+/g, '+'),
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-400 hover:text-blue-600 transition-colors inline-block mt-0.5"
                      >
                        fonts.google.com/specimen/{fav.family}
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopy(fav)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          copiedId === fav.id
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                        title="Copy default snippet"
                      >
                        {copiedId === fav.id ? 'Copied!' : 'Copy'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void removeFavorite(fav.id)}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Remove from favorites"
                      >
                        <svg
                          className="w-4 h-4 fill-current"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>
                    </div>
                  </header>

                  <div className="py-6 overflow-hidden">
                    <p
                      style={{
                        fontFamily: `'${fav.family}', sans-serif`,
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.25,
                      }}
                      className="text-zinc-900 break-words"
                    >
                      {previewText ||
                        'Almost before we knew it, we had left the ground.'}
                    </p>
                  </div>

                  <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {fav.tags?.map((tagId) => {
                        const tag = tags.find((t) => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            style={{
                              backgroundColor: `${tag.color}15`,
                              borderColor: `${tag.color}45`,
                              color: '#27272a',
                            }}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span>{tag.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                void toggleFavoriteTag(fav.id, tag.id);
                              }}
                              className="ml-0.5 text-zinc-400 hover:text-red-600 rounded-full cursor-pointer leading-none"
                              title={`Remove tag "${tag.name}"`}
                              aria-label={`Remove tag ${tag.name}`}
                            >
                              &times;
                            </button>
                          </span>
                        );
                      })}

                      <div
                        data-tag-popover="true"
                        className="relative inline-block"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCardPopoverId((curr) =>
                              curr === fav.id ? null : fav.id,
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 bg-white cursor-pointer transition-colors"
                          title="Assign tags"
                        >
                          <span>+</span>
                          <span>Tag</span>
                        </button>

                        {activeCardPopoverId === fav.id && (
                          <div className="absolute bottom-full left-0 mb-1.5 z-30 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
                              Assign Tags
                            </div>
                            {tags.length === 0 ? (
                              <div className="p-2 text-center text-xs text-zinc-500">
                                <p>No tags created yet.</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCardPopoverId(null);
                                    setIsTagModalOpen(true);
                                  }}
                                  className="mt-2 inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 cursor-pointer"
                                >
                                  + Create Tag
                                </button>
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
                                {tags.map((tag) => {
                                  const isAssigned =
                                    fav.tags?.includes(tag.id) ?? false;
                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => {
                                        void toggleFavoriteTag(fav.id, tag.id);
                                      }}
                                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                                        isAssigned
                                          ? 'bg-zinc-100 font-medium text-zinc-900'
                                          : 'text-zinc-700 hover:bg-zinc-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="truncate">
                                          {tag.name}
                                        </span>
                                      </div>
                                      {isAssigned && (
                                        <span className="text-blue-600 font-bold ml-1">
                                          ✓
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(fav, 'google-link')}
                        className="hover:text-zinc-900 hover:underline cursor-pointer"
                      >
                        &lt;link&gt;
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(fav, 'google-import')}
                        className="hover:text-zinc-900 hover:underline cursor-pointer"
                      >
                        @import
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(fav, 'fontsource')}
                        className="hover:text-zinc-900 hover:underline cursor-pointer"
                      >
                        Fontsource
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-zinc-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md border border-zinc-700/60 max-w-[95vw] overflow-x-auto">
          <span className="text-xs font-semibold whitespace-nowrap">
            {selectedIds.length} {selectedIds.length === 1 ? 'font' : 'fonts'}{' '}
            selected
          </span>
          <div className="h-4 w-px bg-zinc-700 shrink-0" />
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-zinc-300 hover:text-white cursor-pointer underline-offset-2 hover:underline whitespace-nowrap"
          >
            {isAllFilteredSelected
              ? 'Deselect all'
              : `Select all (${filtered.length})`}
          </button>
          <div className="h-4 w-px bg-zinc-700 shrink-0" />
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5 shrink-0">
            {(
              ['google-link', 'google-import', 'fontsource'] as CopyFormat[]
            ).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setMultiCopyFormat(fmt)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                  multiCopyFormat === fmt
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {fmt === 'google-link'
                  ? '<link>'
                  : fmt === 'google-import'
                    ? '@import'
                    : 'Fontsource'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleCopySelected()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer transition-colors whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy Combined Snippet</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
            title="Clear selection"
            aria-label="Clear selection"
          >
            &times;
          </button>
        </div>
      )}

      {isTagModalOpen && (
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
                onClick={() => setIsTagModalOpen(false)}
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
                                  onChange={(e) =>
                                    setEditTagName(e.target.value)
                                  }
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
                onClick={() => setIsTagModalOpen(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
