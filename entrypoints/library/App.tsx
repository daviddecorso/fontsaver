import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { specimenUrl } from '../../src/core/family-id';
import {
  filterFavorites,
  type SortOrder,
  sortFavorites,
} from '../../src/core/search';
import {
  buildFamilyParam,
  buildSnippet,
  getCategoryFallback,
} from '../../src/core/snippets';
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
  defaultSettings,
  exportLibraryData,
  getAllFavorites,
  getTags,
  migrateStorageMode,
  removeFavorite,
  settingsItem,
  toggleFavoriteTag,
  updateFavoriteNote,
  watchFavorites,
  watchStorageQuota,
  watchTags,
} from '../../src/storage/items';
import { copyText } from '../../src/ui/clipboard';
import TagManager from './TagManager';

const CATEGORIES = [
  'all',
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
];

export default function App({
  isSidePanel = false,
}: {
  isSidePanel?: boolean;
}) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [catalog, setCatalog] = useState<CatalogFont[] | undefined>(undefined);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [activeView, setActiveView] = useState<'collection' | 'pairing'>(
    'collection',
  );
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

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>(
    {},
  );

  const [pairingHeadingId, setPairingHeadingId] = useState('');
  const [pairingBodyId, setPairingBodyId] = useState('');
  const [pairingHeadingSize, setPairingHeadingSize] = useState(40);
  const [pairingBodySize, setPairingBodySize] = useState(16);
  const [pairingHeadingText, setPairingHeadingText] = useState(
    'Design Systems & Modern Typography',
  );
  const [pairingSubheadingText, setPairingSubheadingText] = useState(
    'Harmonious typography pairings elevate interfaces and narrative flow.',
  );
  const [pairingBodyText, setPairingBodyText] = useState(
    'Good typography creates clear visual hierarchy, intentional tone, and effortless readability. Pairing a distinctive headline typeface with a clean, legible body text face achieves both character and functionality.',
  );

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [activeCardPopoverId, setActiveCardPopoverId] = useState<string | null>(
    null,
  );

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

    const unwatchCatalog = catalogItem.watch((nextCatalog) => {
      if (nextCatalog?.fonts) setCatalog(nextCatalog.fonts);
    });

    return () => {
      isMounted = false;
      unwatchCatalog();
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
      if (e.key === 'Escape') setActiveCardPopoverId(null);
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    const matched = filterFavorites(favorites, catalog, tags, {
      query,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      variableOnly: variableOnly || undefined,
      subsets: selectedSubsets.length > 0 ? selectedSubsets : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
    return sortFavorites(matched, catalog, sortOrder);
  }, [
    favorites,
    catalog,
    tags,
    query,
    selectedCategory,
    variableOnly,
    selectedSubsets,
    selectedTagIds,
    sortOrder,
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

    const loadChunk = (chunk: string[]) => {
      const families = chunk
        .map((familyName) => {
          const font = catalog?.find(
            (c) => c.family.toLowerCase() === familyName.toLowerCase(),
          );
          return buildFamilyParam(familyName, font);
        })
        .join('&');
      const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-gff-preview-batch', 'true');
      // One bad family fails the whole request, so retry members individually.
      link.onerror = () => {
        link.remove();
        if (chunk.length > 1) {
          for (const family of chunk) loadChunk([family]);
        }
      };
      document.head.appendChild(link);
    };

    const CHUNK_SIZE = 10;
    for (let i = 0; i < toLoad.length; i += CHUNK_SIZE) {
      loadChunk(toLoad.slice(i, i + CHUNK_SIZE));
    }
  }, [catalog]);

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

  const effectiveHeadingFav =
    favorites.find((f) => f.id === pairingHeadingId) ?? favorites[0];
  const effectiveBodyFav =
    favorites.find((f) => f.id === pairingBodyId) ??
    favorites[1] ??
    favorites[0];

  const headingCategoryFallback = getCategoryFallback(
    catalog?.find((c) => c.id === effectiveHeadingFav?.id)?.category,
  );
  const bodyCategoryFallback = getCategoryFallback(
    catalog?.find((c) => c.id === effectiveBodyFav?.id)?.category,
  );
  const pairingHeadingFontFamily = effectiveHeadingFav
    ? `'${effectiveHeadingFav.family}', ${headingCategoryFallback}`
    : 'sans-serif';
  const pairingBodyFontFamily = effectiveBodyFav
    ? `'${effectiveBodyFav.family}', ${bodyCategoryFallback}`
    : 'sans-serif';

  useEffect(() => {
    if (activeView !== 'pairing') return;
    const toLoad = [
      effectiveHeadingFav?.family,
      effectiveBodyFav?.family,
    ].filter(Boolean) as string[];
    for (const f of toLoad) {
      if (!loadedFamiliesRef.current.has(f)) {
        visibleFamiliesRef.current.add(f);
      }
    }
    flushBatchedFonts();
  }, [activeView, effectiveHeadingFav, effectiveBodyFav, flushBatchedFonts]);

  const handleCopy = async (fav: Favorite, format?: string) => {
    const copyFormat = (format ?? settings.copyFormat) as CopyFormat;
    const snippet = buildSnippet({
      favorites: [fav],
      settings: {
        ...settings,
        copyFormat,
      },
      catalog,
    });

    if (!(await copyText(snippet))) {
      showToast('Copy failed');
      return;
    }

    setCopiedId(fav.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === fav.id ? null : curr));
    }, 1500);
  };

  const handleSaveNote = async (fontId: string) => {
    await updateFavoriteNote(fontId, noteInput);
    setEditingNoteId(null);
    showToast('Note updated');
  };

  const handleSwapPairing = () => {
    const currentHeading = effectiveHeadingFav?.id || '';
    const currentBody = effectiveBodyFav?.id || '';
    setPairingHeadingId(currentBody);
    setPairingBodyId(currentHeading);
  };

  const handleCopyPairing = async (format: CopyFormat) => {
    if (!effectiveHeadingFav || !effectiveBodyFav) return;
    const pairFavs =
      effectiveHeadingFav.id === effectiveBodyFav.id
        ? [effectiveHeadingFav]
        : [effectiveHeadingFav, effectiveBodyFav];

    const snippet = buildSnippet({
      favorites: pairFavs,
      settings: {
        ...settings,
        copyFormat: format,
      },
      catalog,
    });

    if (!(await copyText(snippet))) {
      showToast('Copy failed');
      return;
    }
    showToast(`Copied pair snippet (${format})!`);
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

    if (!(await copyText(snippet))) {
      showToast('Copy failed');
      return;
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-red-500 fill-current shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Font Library
            </h1>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {favorites.length}
            </span>

            <div className="ml-2 flex items-center rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveView('collection')}
                className={`rounded-md px-3 py-1 cursor-pointer transition-colors ${
                  activeView === 'collection'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Collection
              </button>
              <button
                type="button"
                onClick={() => setActiveView('pairing')}
                className={`rounded-md px-3 py-1 cursor-pointer transition-colors ${
                  activeView === 'pairing'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Font Pairing
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isSidePanel && (
              <button
                type="button"
                onClick={() => {
                  void browser.tabs.create({
                    url: browser.runtime.getURL('/library.html'),
                  });
                }}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                title="Open in full browser tab"
              >
                <span>Full Tab</span>
                <span>↗</span>
              </button>
            )}

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

        {activeView === 'pairing' ? (
          <div className="space-y-6 pb-20">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">
                    Font Pairing Playground
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Select a heading and body font from your favorites to
                    preview typographic hierarchy and copy paired snippets.
                  </p>
                </div>
              </div>

              {favorites.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Save at least one favorite font to use the pairing tool.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label
                        htmlFor="heading-font-select"
                        className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
                      >
                        Heading Font
                      </label>
                      <select
                        id="heading-font-select"
                        value={effectiveHeadingFav?.id ?? ''}
                        onChange={(e) => setPairingHeadingId(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-hidden cursor-pointer"
                      >
                        {favorites.map((fav) => (
                          <option key={fav.id} value={fav.id}>
                            {fav.family}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-zinc-400">
                          Heading Size
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {pairingHeadingSize}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={24}
                        max={64}
                        value={pairingHeadingSize}
                        onChange={(e) =>
                          setPairingHeadingSize(Number(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col items-center justify-center pb-2">
                      <button
                        type="button"
                        onClick={handleSwapPairing}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 cursor-pointer transition-colors shadow-2xs"
                        title="Swap Heading and Body fonts"
                      >
                        <svg
                          className="w-4 h-4 text-zinc-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        <span>Swap Roles</span>
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="body-font-select"
                        className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
                      >
                        Body Font
                      </label>
                      <select
                        id="body-font-select"
                        value={effectiveBodyFav?.id ?? ''}
                        onChange={(e) => setPairingBodyId(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-hidden cursor-pointer"
                      >
                        {favorites.map((fav) => (
                          <option key={fav.id} value={fav.id}>
                            {fav.family}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-zinc-400">
                          Body Size
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {pairingBodySize}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={24}
                        value={pairingBodySize}
                        onChange={(e) =>
                          setPairingBodySize(Number(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">
                      Pairing:{' '}
                      <strong className="text-zinc-800">
                        {effectiveHeadingFav?.family ?? 'None'}
                      </strong>{' '}
                      (Heading) +{' '}
                      <strong className="text-zinc-800">
                        {effectiveBodyFav?.family ?? 'None'}
                      </strong>{' '}
                      (Body)
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-zinc-400 mr-1">
                        Copy paired snippet:
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyPairing('tailwind-v4')}
                        className="rounded-md bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 cursor-pointer transition-colors"
                      >
                        Tailwind v4
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPairing('next-font')}
                        className="rounded-md bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 cursor-pointer transition-colors"
                      >
                        Next.js
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPairing('google-link')}
                        className="rounded-md bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 cursor-pointer transition-colors"
                      >
                        &lt;link&gt;
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPairing('fontsource')}
                        className="rounded-md bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 cursor-pointer transition-colors"
                      >
                        Fontsource
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-12 shadow-sm space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <span>Typography Specimen</span>
                <span>•</span>
                <span>Live Hierarchy</span>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  aria-label="Specimen heading text"
                  value={pairingHeadingText}
                  onChange={(e) => setPairingHeadingText(e.target.value)}
                  style={{
                    fontFamily: pairingHeadingFontFamily,
                    fontSize: `${pairingHeadingSize}px`,
                    lineHeight: 1.15,
                  }}
                  className="w-full text-zinc-950 font-bold tracking-tight bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-blue-500 focus:outline-hidden transition-colors"
                />

                <input
                  type="text"
                  aria-label="Specimen subheading text"
                  value={pairingSubheadingText}
                  onChange={(e) => setPairingSubheadingText(e.target.value)}
                  style={{
                    fontFamily: pairingHeadingFontFamily,
                    fontSize: `${Math.round(pairingHeadingSize * 0.55)}px`,
                    lineHeight: 1.3,
                  }}
                  className="w-full text-zinc-600 font-medium bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-blue-500 focus:outline-hidden transition-colors"
                />
              </div>

              <div className="h-px bg-zinc-100 my-6" />

              <div className="max-w-3xl">
                <textarea
                  rows={4}
                  aria-label="Specimen body text"
                  value={pairingBodyText}
                  onChange={(e) => setPairingBodyText(e.target.value)}
                  style={{
                    fontFamily: pairingBodyFontFamily,
                    fontSize: `${pairingBodySize}px`,
                    lineHeight: 1.7,
                  }}
                  className="w-full text-zinc-700 bg-transparent border border-transparent hover:border-zinc-200 focus:border-blue-500 focus:outline-hidden rounded-md p-1 transition-colors resize-y"
                />
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button
                  type="button"
                  style={{
                    fontFamily: pairingHeadingFontFamily,
                  }}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  Get Started
                </button>
                <span
                  style={{
                    fontFamily: pairingBodyFontFamily,
                  }}
                  className="text-xs text-zinc-400"
                >
                  Click any text above to edit copy directly.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
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
                  placeholder="Search font, tag, or note..."
                  className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="sort-order"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
                >
                  Sort By
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="newest">Recently Added</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alpha-asc">Name (A → Z)</option>
                  <option value="alpha-desc">Name (Z → A)</option>
                  <option value="category">Category</option>
                </select>
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
                  Browse Google Fonts and click the heart icon on any font card
                  to add it to your collection.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void browser.tabs.create({
                      url: 'https://fonts.google.com',
                    })
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
                            href={specimenUrl(fav.family)}
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

                      <div className="py-4 overflow-hidden">
                        {fontInfo?.variable ? (
                          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2.5">
                            <span className="font-mono text-[11px] text-zinc-500">
                              Weight: {customWeights[fav.id] ?? 400}
                            </span>
                            <input
                              type="range"
                              min={100}
                              max={900}
                              step={50}
                              value={customWeights[fav.id] ?? 400}
                              onChange={(e) =>
                                setCustomWeights((prev) => ({
                                  ...prev,
                                  [fav.id]: Number(e.target.value),
                                }))
                              }
                              className="w-24 accent-blue-600 cursor-pointer"
                              title="Adjust variable font weight"
                            />
                          </div>
                        ) : fontInfo?.weights && fontInfo.weights.length > 1 ? (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2.5">
                            <span className="text-[11px] text-zinc-400">
                              Weight:
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {fontInfo.weights.map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() =>
                                    setCustomWeights((prev) => ({
                                      ...prev,
                                      [fav.id]: w,
                                    }))
                                  }
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer transition-colors ${
                                    (customWeights[fav.id] ?? 400) === w
                                      ? 'bg-zinc-900 text-white font-semibold'
                                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                  }`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <p
                          style={{
                            fontFamily: `'${fav.family}', sans-serif`,
                            fontSize: `${fontSize}px`,
                            fontWeight: customWeights[fav.id] ?? 400,
                            lineHeight: 1.25,
                          }}
                          className="text-zinc-900 break-words"
                        >
                          {previewText ||
                            'Almost before we knew it, we had left the ground.'}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-zinc-100">
                          {editingNoteId === fav.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder="Add note (e.g. Brand body, Client hero)..."
                                className="flex-1 rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs text-zinc-900 focus:outline-hidden"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')
                                    void handleSaveNote(fav.id);
                                  if (e.key === 'Escape')
                                    setEditingNoteId(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveNote(fav.id)}
                                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : fav.note ? (
                            <div className="flex items-center justify-between text-xs text-zinc-600 bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-zinc-200/60">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-zinc-400 font-medium">
                                  Note:
                                </span>
                                <span className="truncate">{fav.note}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(fav.id);
                                  setNoteInput(fav.note ?? '');
                                }}
                                className="ml-2 text-zinc-400 hover:text-zinc-700 cursor-pointer shrink-0 text-[11px]"
                                title="Edit note"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(fav.id);
                                setNoteInput('');
                              }}
                              className="text-[11px] text-zinc-400 hover:text-zinc-700 cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>+</span>
                              <span>Add note</span>
                            </button>
                          )}
                        </div>
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
                                            void toggleFavoriteTag(
                                              fav.id,
                                              tag.id,
                                            );
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
                                              style={{
                                                backgroundColor: tag.color,
                                              }}
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

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
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
                            onClick={() =>
                              void handleCopy(fav, 'google-import')
                            }
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
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(fav, 'tailwind-v4')}
                            className="hover:text-zinc-900 hover:underline cursor-pointer"
                          >
                            Tailwind
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(fav, 'next-font')}
                            className="hover:text-zinc-900 hover:underline cursor-pointer"
                          >
                            Next.js
                          </button>
                        </div>
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}
          </>
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
              [
                'google-link',
                'google-import',
                'fontsource',
                'tailwind-v4',
                'tailwind-v3',
                'next-font',
              ] as CopyFormat[]
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
                    : fmt === 'fontsource'
                      ? 'Fontsource'
                      : fmt === 'tailwind-v4'
                        ? 'Tailwind v4'
                        : fmt === 'tailwind-v3'
                          ? 'Tailwind v3'
                          : 'Next.js'}
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

      <TagManager
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        tags={tags}
        favorites={favorites}
        onTagDeleted={(tagId) =>
          setSelectedTagIds((curr) => curr.filter((id) => id !== tagId))
        }
      />
    </div>
  );
}
