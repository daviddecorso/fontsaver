import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { validateExportData } from '../../src/core/export-import';
import type {
  Catalog,
  CopyFormat,
  FontDisplay,
  PackageManager,
  Settings,
  StorageMode,
} from '../../src/core/types';
import {
  catalogItem,
  defaultSettings,
  exportLibraryData,
  getAllFavorites,
  getStorageQuotaStats,
  importLibraryData,
  migrateStorageMode,
  refreshCatalogCache,
  settingsItem,
} from '../../src/storage/items';

const WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const DISPLAY_OPTIONS: { label: string; value: FontDisplay; desc: string }[] = [
  {
    label: 'swap',
    value: 'swap',
    desc: 'Brief fallback before font renders (recommended)',
  },
  {
    label: 'optional',
    value: 'optional',
    desc: 'Uses fallback if font takes too long, cached on next load',
  },
  {
    label: 'block',
    value: 'block',
    desc: 'Hides text until font loads (up to 3s)',
  },
  {
    label: 'fallback',
    value: 'fallback',
    desc: 'Extremely short block, swap fallback period',
  },
  {
    label: 'auto',
    value: 'auto',
    desc: 'Browser chooses display strategy',
  },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [quota, setQuota] = useState<{
    bytesUsed: number;
    totalBytes: number;
    itemCount: number;
    maxItems: number;
    percentUsed: number;
    isNearLimit: boolean;
    isOverLimit: boolean;
  } | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [showModeMigrationModal, setShowModeMigrationModal] =
    useState<StorageMode | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const loadData = useCallback(async () => {
    const [storedSettings, storedCatalog, quotaStats, favs] = await Promise.all(
      [
        settingsItem.getValue(),
        catalogItem.getValue(),
        getStorageQuotaStats(),
        getAllFavorites(),
      ],
    );

    if (storedSettings) setSettings(storedSettings);
    if (storedCatalog) setCatalog(storedCatalog);
    setQuota(quotaStats);
    setFavoritesCount(favs.length);
  }, []);

  useEffect(() => {
    void loadData();

    const unwatchSettings = settingsItem.watch((next) => {
      if (next) setSettings(next);
      void getStorageQuotaStats().then(setQuota);
    });

    const unwatchCatalog = catalogItem.watch((next) => {
      setCatalog(next);
    });

    return () => {
      unwatchSettings();
      unwatchCatalog();
    };
  }, [loadData]);

  const updateSettings = async (updates: Partial<Settings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await settingsItem.setValue(updated);
    showToast('Settings saved');
    void getStorageQuotaStats().then(setQuota);
  };

  const toggleWeight = (weight: number) => {
    const current = settings.defaultWeights ?? [400, 700];
    let next: number[];
    if (current.includes(weight)) {
      if (current.length === 1) return; // Keep at least one weight
      next = current.filter((w) => w !== weight);
    } else {
      next = [...current, weight].sort((a, b) => a - b);
    }
    void updateSettings({ defaultWeights: next });
  };

  const handleRefreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    setCatalogNotice(null);
    try {
      const refreshed = await refreshCatalogCache();
      setCatalog(refreshed);
      setCatalogNotice(
        `Catalog updated with ${refreshed.fonts.length.toLocaleString()} fonts.`,
      );
      showToast('Catalog refreshed');
    } catch (err) {
      setCatalogNotice(
        `Failed to refresh catalog: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const handleExport = async () => {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportNotice(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportError('File is not valid JSON.');
        return;
      }

      const validation = validateExportData(parsed);
      if (!validation.valid) {
        setImportError(validation.error);
        return;
      }

      const result = await importLibraryData(validation.data, importMode);
      setImportNotice(
        `Successfully imported ${result.favoritesCount} favorites and ${result.tagsCount} tags.`,
      );
      showToast('Backup imported');
      void loadData();
    } catch (err) {
      setImportError(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleModeSwitchRequest = (newMode: StorageMode) => {
    if (newMode === settings.storageMode) return;
    setShowModeMigrationModal(newMode);
  };

  const confirmModeMigration = async (migrateData: boolean) => {
    const targetMode = showModeMigrationModal;
    if (!targetMode) return;

    setIsMigrating(true);
    try {
      if (migrateData) {
        await migrateStorageMode(targetMode);
        showToast(
          `Switched to ${targetMode} storage and migrated your collection.`,
        );
      } else {
        await updateSettings({ storageMode: targetMode });
        showToast(`Switched storage mode to ${targetMode}.`);
      }
      setShowModeMigrationModal(null);
      void loadData();
    } catch {
      showToast('Failed to update storage mode.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleOpenLibrary = () => {
    const url = browser.runtime.getURL('/library.html');
    void browser.tabs.create({ url });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all">
          {toastMessage}
        </div>
      )}

      {/* Migration Confirmation Modal */}
      {showModeMigrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">
              Switch to {showModeMigrationModal === 'local' ? 'Local' : 'Sync'}{' '}
              Storage?
            </h3>
            <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
              {showModeMigrationModal === 'local'
                ? 'Local storage stores your collection exclusively on this device with a 10 MB limit. Would you like to copy your current synced favorites and tags to local storage?'
                : 'Sync storage syncs your collection across devices via your browser account (capped at 100 KB). Would you like to copy your local favorites and tags into sync storage?'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => setShowModeMigrationModal(null)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => void confirmModeMigration(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Switch Without Migrating
              </button>
              <button
                type="button"
                disabled={isMigrating}
                onClick={() => void confirmModeMigration(true)}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                {isMigrating ? 'Migrating...' : 'Migrate & Switch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-6 py-4 shadow-xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-red-500 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 leading-none">
                Settings
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Google Fonts Favorites preferences & storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenLibrary}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <span>Open Font Library</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Section 1: Snippet Defaults */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <header className="border-b border-zinc-100 pb-3 mb-5">
            <h2 className="text-base font-bold text-zinc-900">
              Snippet Preferences
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Configure how ready-to-paste snippets are generated when you click
              Copy.
            </p>
          </header>

          <div className="space-y-6">
            {/* Copy Format */}
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Default Copy Format
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'google-link',
                    label: 'Google <link>',
                    desc: 'Preconnect links + CSS link tag',
                  },
                  {
                    id: 'google-import',
                    label: 'Google @import',
                    desc: 'CSS @import statement + font-family',
                  },
                  {
                    id: 'fontsource',
                    label: 'Fontsource',
                    desc: 'Package install + JS/CSS import',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all ${
                      settings.copyFormat === item.id
                        ? 'border-blue-600 bg-blue-50/40 text-blue-950 ring-1 ring-blue-600'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {item.label}
                      </span>
                      <input
                        type="radio"
                        name="copyFormat"
                        value={item.id}
                        checked={settings.copyFormat === item.id}
                        onChange={(e) =>
                          void updateSettings({
                            copyFormat: e.target.value as CopyFormat,
                          })
                        }
                        className="accent-blue-600"
                      />
                    </div>
                    <span className="mt-1 text-[11px] text-zinc-500">
                      {item.desc}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Package Manager */}
            <div>
              <label
                htmlFor="package-manager-select"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2"
              >
                Package Manager (Fontsource)
              </label>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {(['pnpm', 'npm', 'yarn', 'bun'] as PackageManager[]).map(
                  (pm) => (
                    <button
                      key={pm}
                      id={`pm-${pm}`}
                      type="button"
                      onClick={() =>
                        void updateSettings({ packageManager: pm })
                      }
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        settings.packageManager === pm
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {pm}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Prefer Variable */}
            <div className="flex items-start justify-between rounded-lg border border-zinc-100 bg-zinc-50/60 p-3.5">
              <div className="pr-4">
                <span className="text-sm font-semibold text-zinc-900">
                  Prefer Variable Fonts
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  When enabled, fonts that support variable axes use dynamic
                  ranges (e.g.{' '}
                  <code className="text-zinc-700 bg-zinc-200/60 px-1 py-0.5 rounded-xs">
                    wght@100..900
                  </code>
                  ) and{' '}
                  <code className="text-zinc-700 bg-zinc-200/60 px-1 py-0.5 rounded-xs">
                    @fontsource-variable
                  </code>{' '}
                  packages.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preferVariable}
                  onChange={(e) =>
                    void updateSettings({ preferVariable: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {/* Default Weights */}
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                Default Weights for Static Fonts
              </span>
              <p className="text-xs text-zinc-500 mb-2">
                Applied to non-variable fonts or when variable font preference
                is disabled.
              </p>
              <div className="flex flex-wrap gap-2">
                {WEIGHT_OPTIONS.map((w) => {
                  const isSelected = settings.defaultWeights?.includes(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggleWeight(w)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Display */}
            <div>
              <label
                htmlFor="font-display-select"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1"
              >
                CSS font-display
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {DISPLAY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all ${
                      settings.display === opt.value
                        ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-600'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fontDisplay"
                      value={opt.value}
                      checked={settings.display === opt.value}
                      onChange={(e) =>
                        void updateSettings({
                          display: e.target.value as FontDisplay,
                        })
                      }
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <span className="block text-xs font-bold text-zinc-900">
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Catalog Cache */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <header className="border-b border-zinc-100 pb-3 mb-4">
            <h2 className="text-base font-bold text-zinc-900">
              Fontsource Catalog Cache
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              The catalog maps Google Font family names to Fontsource package
              IDs, categories, and weights. It refreshes weekly in the
              background.
            </p>
          </header>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-zinc-800">
                  {catalog
                    ? `${catalog.fonts.length.toLocaleString()} Google font families cached`
                    : 'Catalog not yet cached'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Last updated:{' '}
                {catalog?.fetchedAt
                  ? new Date(catalog.fetchedAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>

            <button
              type="button"
              disabled={isRefreshingCatalog}
              onClick={() => void handleRefreshCatalog()}
              className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isRefreshingCatalog ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Catalog Now</span>
                </>
              )}
            </button>
          </div>

          {catalogNotice && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 border border-zinc-200">
              {catalogNotice}
            </div>
          )}
        </section>

        {/* Section 3: Storage & Quota */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <header className="border-b border-zinc-100 pb-3 mb-5">
            <h2 className="text-base font-bold text-zinc-900">
              Storage & Sync Mode
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage where your font collections and tags are stored and monitor
              browser sync quota.
            </p>
          </header>

          <div className="space-y-6">
            {/* Storage Mode Selector */}
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Storage Destination
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleModeSwitchRequest('sync')}
                  className={`flex flex-col text-left rounded-lg border p-3.5 cursor-pointer transition-all ${
                    settings.storageMode === 'sync'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-950 ring-1 ring-blue-600'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">
                      Sync (Cross-Device)
                    </span>
                    {settings.storageMode === 'sync' && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-xs text-zinc-500">
                    Syncs automatically across your signed-in browser instances
                    (100 KB limit).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeSwitchRequest('local')}
                  className={`flex flex-col text-left rounded-lg border p-3.5 cursor-pointer transition-all ${
                    settings.storageMode === 'local'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-950 ring-1 ring-blue-600'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">
                      Local (This Device Only)
                    </span>
                    {settings.storageMode === 'local' && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-xs text-zinc-500">
                    Stores your library strictly on this computer with an
                    expanded 10 MB limit.
                  </span>
                </button>
              </div>
            </fieldset>

            {/* Sync Quota Progress Monitor */}
            {quota && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700">
                    Sync Storage Capacity
                  </span>
                  <span className="text-zinc-500">
                    {(quota.bytesUsed / 1024).toFixed(1)} KB /{' '}
                    {(quota.totalBytes / 1024).toFixed(0)} KB (
                    {quota.percentUsed}%)
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full transition-all ${
                      quota.isOverLimit
                        ? 'bg-red-600'
                        : quota.isNearLimit
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    Items: {quota.itemCount} / {quota.maxItems}
                  </span>
                  <span>Active favorites in library: {favoritesCount}</span>
                </div>

                {quota.isNearLimit && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
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
                      <p className="font-semibold">Sync Storage Warning</p>
                      <p className="mt-0.5 text-[11px]">
                        You are nearing the 100 KB browser sync limit. Consider
                        switching to &ldquo;Local (This Device Only)&rdquo; to
                        ensure you can continue saving favorites without
                        interruption.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Backup & Portability */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <header className="border-b border-zinc-100 pb-3 mb-5">
            <h2 className="text-base font-bold text-zinc-900">
              Import & Export (JSON Backup)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Export your favorites and tags to a portable JSON file or restore
              a backup.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Export Library
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Downloads a full JSON snapshot of all your favorites, tags,
                  and settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleExport()}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export Library JSON</span>
              </button>
            </div>

            {/* Import Card */}
            <div className="flex flex-col justify-between rounded-lg border border-zinc-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Import Library
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Restore favorites and tags from an exported JSON file.
                </p>

                <div className="mt-3 flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="accent-blue-600"
                    />
                    <span>Merge with existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-blue-600"
                    />
                    <span>Replace all</span>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                  id="import-file-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Select JSON File to Import</span>
                </button>
              </div>
            </div>
          </div>

          {importError && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {importError}
            </div>
          )}

          {importNotice && (
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              {importNotice}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
