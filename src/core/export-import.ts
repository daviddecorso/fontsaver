import type {
  CopyFormat,
  ExportData,
  Favorite,
  FontDisplay,
  PackageManager,
  Settings,
  StorageQuotaStats,
  Tag,
} from './types';

export const SYNC_QUOTA_BYTES = 102400;
export const SYNC_MAX_ITEMS = 512;
export const QUOTA_WARNING_RATIO = 0.8;
export const EXPORT_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_FAMILY_LENGTH = 100;
const MAX_NOTE_LENGTH = 2000;
const MAX_TAG_NAME_LENGTH = 32;
const DEFAULT_TAG_COLOR = '#64748b';

const COPY_FORMATS: readonly CopyFormat[] = [
  'google-link',
  'google-import',
  'fontsource',
  'tailwind-v4',
  'tailwind-v3',
  'next-font',
];
const PACKAGE_MANAGERS: readonly PackageManager[] = [
  'pnpm',
  'npm',
  'yarn',
  'bun',
];
const FONT_DISPLAYS: readonly FontDisplay[] = [
  'swap',
  'optional',
  'block',
  'fallback',
  'auto',
];

export function createExportPayload(
  favorites: Favorite[],
  tags: Tag[],
  settings?: Settings,
): ExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    favorites: [...favorites],
    tags: [...tags],
    settings: settings ? { ...settings } : undefined,
  };
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function sanitizeFavorite(raw: unknown): Favorite | null {
  if (!raw || typeof raw !== 'object') return null;
  const fav = raw as Record<string, unknown>;

  if (typeof fav.id !== 'string' || !ID_PATTERN.test(fav.id)) return null;
  if (typeof fav.family !== 'string') return null;
  const family = fav.family.trim();
  if (
    family.length === 0 ||
    family.length > MAX_FAMILY_LENGTH ||
    hasControlChars(family)
  ) {
    return null;
  }
  if (!Array.isArray(fav.tags)) return null;

  const tags = Array.from(
    new Set(
      fav.tags.filter(
        (tagId): tagId is string =>
          typeof tagId === 'string' && ID_PATTERN.test(tagId),
      ),
    ),
  );

  const note =
    typeof fav.note === 'string'
      ? fav.note.trim().slice(0, MAX_NOTE_LENGTH)
      : '';

  return {
    id: fav.id,
    family,
    addedAt:
      typeof fav.addedAt === 'number' && Number.isFinite(fav.addedAt)
        ? fav.addedAt
        : Date.now(),
    tags,
    ...(note ? { note } : {}),
  };
}

function sanitizeTag(raw: unknown): Tag | null {
  if (!raw || typeof raw !== 'object') return null;
  const tag = raw as Record<string, unknown>;

  if (typeof tag.id !== 'string' || !ID_PATTERN.test(tag.id)) return null;
  if (typeof tag.name !== 'string') return null;
  const name = tag.name.trim().slice(0, MAX_TAG_NAME_LENGTH);
  if (!name || hasControlChars(name)) return null;

  return {
    id: tag.id,
    name,
    color:
      typeof tag.color === 'string' && HEX_COLOR_PATTERN.test(tag.color)
        ? tag.color
        : DEFAULT_TAG_COLOR,
  };
}

function sanitizeSettings(raw: unknown): Partial<Settings> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const result: Partial<Settings> = {};

  if (COPY_FORMATS.includes(input.copyFormat as CopyFormat)) {
    result.copyFormat = input.copyFormat as CopyFormat;
  }
  if (PACKAGE_MANAGERS.includes(input.packageManager as PackageManager)) {
    result.packageManager = input.packageManager as PackageManager;
  }
  if (typeof input.preferVariable === 'boolean') {
    result.preferVariable = input.preferVariable;
  }
  if (FONT_DISPLAYS.includes(input.display as FontDisplay)) {
    result.display = input.display as FontDisplay;
  }
  if (Array.isArray(input.defaultWeights)) {
    const weights = Array.from(
      new Set(
        input.defaultWeights.filter(
          (w): w is number =>
            typeof w === 'number' &&
            Number.isInteger(w) &&
            w >= 100 &&
            w <= 900 &&
            w % 100 === 0,
        ),
      ),
    ).sort((a, b) => a - b);
    if (weights.length > 0) result.defaultWeights = weights;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function validateExportData(
  data: unknown,
): { valid: true; data: ExportData } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid backup format: root must be an object',
    };
  }

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.version !== 'number') {
    return { valid: false, error: 'Missing or invalid "version" field' };
  }

  if (candidate.version > EXPORT_VERSION) {
    return {
      valid: false,
      error: 'This backup was created by a newer version of the extension',
    };
  }

  if (!Array.isArray(candidate.favorites)) {
    return { valid: false, error: '"favorites" must be an array' };
  }

  const favoritesById = new Map<string, Favorite>();
  for (let index = 0; index < candidate.favorites.length; index += 1) {
    const fav = sanitizeFavorite(candidate.favorites[index]);
    if (!fav) {
      return {
        valid: false,
        error: `Favorite at index ${index} has invalid properties`,
      };
    }
    favoritesById.set(fav.id, fav);
  }

  const tagsById = new Map<string, Tag>();
  if (candidate.tags !== undefined) {
    if (!Array.isArray(candidate.tags)) {
      return { valid: false, error: '"tags" must be an array' };
    }
    for (let index = 0; index < candidate.tags.length; index += 1) {
      const tag = sanitizeTag(candidate.tags[index]);
      if (!tag) {
        return {
          valid: false,
          error: `Tag at index ${index} has invalid properties`,
        };
      }
      tagsById.set(tag.id, tag);
    }
  }

  return {
    valid: true,
    data: {
      version: candidate.version,
      exportedAt:
        typeof candidate.exportedAt === 'number'
          ? candidate.exportedAt
          : Date.now(),
      favorites: Array.from(favoritesById.values()),
      tags: Array.from(tagsById.values()),
      settings: sanitizeSettings(candidate.settings),
    },
  };
}

export function mergeFavorites(
  existing: Favorite[],
  incoming: Favorite[],
): Favorite[] {
  const map = new Map<string, Favorite>();

  for (const fav of existing) {
    map.set(fav.id, { ...fav, tags: [...fav.tags] });
  }

  for (const inc of incoming) {
    const current = map.get(inc.id);
    if (!current) {
      map.set(inc.id, { ...inc, tags: [...inc.tags] });
      continue;
    }

    const combinedTags = Array.from(new Set([...current.tags, ...inc.tags]));
    map.set(inc.id, {
      ...current,
      ...inc,
      addedAt: Math.max(current.addedAt || 0, inc.addedAt || 0),
      note: inc.note || current.note,
      tags: combinedTags,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
  );
}

export function mergeTags(existing: Tag[], incoming: Tag[]): Tag[] {
  const map = new Map<string, Tag>();
  for (const tag of existing) {
    map.set(tag.id, tag);
  }
  for (const tag of incoming) {
    map.set(tag.id, tag);
  }
  return Array.from(map.values());
}

export function calculateStorageUsage(
  snapshot: Record<string, unknown>,
): StorageQuotaStats {
  const keys = Object.keys(snapshot);
  const itemCount = keys.length;

  let bytesUsed = 0;
  const encoder = new TextEncoder();
  for (const [key, val] of Object.entries(snapshot)) {
    const serialized = JSON.stringify(val) ?? '';
    bytesUsed += encoder.encode(key).length + encoder.encode(serialized).length;
  }

  const percentUsed = Math.min(
    100,
    Math.round((bytesUsed / SYNC_QUOTA_BYTES) * 100),
  );
  const isNearLimit =
    bytesUsed >= SYNC_QUOTA_BYTES * QUOTA_WARNING_RATIO ||
    itemCount >= SYNC_MAX_ITEMS * QUOTA_WARNING_RATIO;
  const isOverLimit =
    bytesUsed >= SYNC_QUOTA_BYTES || itemCount >= SYNC_MAX_ITEMS;

  return {
    bytesUsed,
    totalBytes: SYNC_QUOTA_BYTES,
    itemCount,
    maxItems: SYNC_MAX_ITEMS,
    percentUsed,
    isNearLimit,
    isOverLimit,
  };
}

export function exceedsSyncQuota(snapshot: Record<string, unknown>): boolean {
  const stats = calculateStorageUsage(snapshot);
  return stats.bytesUsed > SYNC_QUOTA_BYTES || stats.itemCount > SYNC_MAX_ITEMS;
}
