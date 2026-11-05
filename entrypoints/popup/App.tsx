import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { filterFavorites } from '../../src/core/search';
import {
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
  type SnippetContext,
} from '../../src/core/snippets';
import type {
  CatalogFont,
  Favorite,
  Settings,
  Tag,
} from '../../src/core/types';
import {
  catalogItem,
  defaultSettings,
  getAllFavorites,
  getTags,
  removeFavorite,
  settingsItem,
  watchFavorites,
  watchTags,
} from '../../src/storage/items';

export default function App() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [catalog, setCatalog] = useState<CatalogFont[] | undefined>(undefined);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      if (sett) setSettings(sett);
      if (tg) setTags(tg);
      setIsLoading(false);
    });

    const unwatchFavs = watchFavorites((nextFavs) => {
      setFavorites(nextFavs);
    });

    const unwatchSettings = settingsItem.watch((nextSettings) => {
      if (nextSettings) setSettings(nextSettings);
    });

    const unwatchTags = watchTags((nextTags) => {
      setTags(nextTags);
    });

    return () => {
      isMounted = false;
      unwatchFavs();
      unwatchSettings();
      unwatchTags();
    };
  }, []);

  const handleCopy = async (fav: Favorite) => {
    const context: SnippetContext = {
      favorites: [fav],
      settings,
      catalog,
    };

    let snippet = '';
    if (settings.copyFormat === 'google-import') {
      snippet = buildGoogleImportSnippet(context);
    } else if (settings.copyFormat === 'fontsource') {
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

  const handleOpenLibrary = () => {
    const url = browser.runtime.getURL('/library.html');
    void browser.tabs.create({ url });
  };

  const handleOpenSettings = () => {
    if (browser.runtime.openOptionsPage) {
      void browser.runtime.openOptionsPage();
    } else {
      void browser.tabs.create({
        url: browser.runtime.getURL('/options.html'),
      });
    }
  };

  const handleOpenFont = (family: string) => {
    const url = `https://fonts.google.com/specimen/${encodeURIComponent(
      family.replace(/\s+/g, '+'),
    )}`;
    void browser.tabs.create({ url });
  };

  const handleOpenGoogleFonts = () => {
    void browser.tabs.create({ url: 'https://fonts.google.com' });
  };

  const filtered = filterFavorites(favorites, catalog, tags, { query });

  return (
    <div className="flex flex-col h-[520px] w-80 bg-zinc-50 text-zinc-900 font-sans">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-500 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <h1 className="text-base font-semibold leading-none">Favorites</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {favorites.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenLibrary}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            Open Library
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
            title="Settings"
            aria-label="Open Settings"
          >
            <svg
              className="w-4 h-4 fill-none stroke-current"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="border-b border-zinc-200 bg-white p-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search favorites..."
            className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
            Loading...
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <svg
              className="w-10 h-10 text-zinc-300 mb-2 stroke-current fill-none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <p className="text-sm font-medium text-zinc-700">
              No favorites yet
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Heart any font on Google Fonts to save it here.
            </p>
            <button
              type="button"
              onClick={handleOpenGoogleFonts}
              className="mt-4 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Browse Google Fonts
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
            No fonts matching &ldquo;{query}&rdquo;
          </div>
        ) : (
          filtered.map((fav) => (
            <div
              key={fav.id}
              className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 shadow-2xs hover:border-zinc-300 transition-colors"
            >
              <div className="min-w-0 flex-1 pr-2">
                <button
                  type="button"
                  onClick={() => handleOpenFont(fav.family)}
                  className="block truncate text-left text-sm font-semibold text-zinc-900 hover:text-blue-600 cursor-pointer"
                  title={`Open ${fav.family} on Google Fonts`}
                >
                  {fav.family}
                </button>
                {fav.tags && fav.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {fav.tags.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      return (
                        <span
                          key={tagId}
                          style={
                            tag
                              ? {
                                  backgroundColor: `${tag.color}18`,
                                  borderColor: `${tag.color}45`,
                                }
                              : undefined
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700"
                        >
                          {tag && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span>{tag?.name ?? tagId}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(fav)}
                  className={`rounded-md p-1.5 text-xs cursor-pointer transition-colors ${
                    copiedId === fav.id
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                  title={copiedId === fav.id ? 'Copied!' : 'Copy Snippet'}
                >
                  {copiedId === fav.id ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 fill-none stroke-current"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
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
            </div>
          ))
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white p-2.5">
        <button
          type="button"
          onClick={handleOpenLibrary}
          className="w-full rounded-md bg-zinc-900 py-2 text-center text-xs font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Open Full Library
        </button>
      </footer>
    </div>
  );
}
