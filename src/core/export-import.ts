import type {
  ExportData,
  Favorite,
  Settings,
  StorageQuotaStats,
  Tag,
} from './types';

export const SYNC_QUOTA_BYTES = 102400;
export const SYNC_MAX_ITEMS = 512;
export const QUOTA_WARNING_RATIO = 0.8;

export function createExportPayload(
  favorites: Favorite[],
  tags: Tag[],
  settings?: Settings,
): ExportData {
  return {
    version: 1,
    exportedAt: Date.now(),
    favorites: [...favorites],
    tags: [...tags],
    settings: settings ? { ...settings } : undefined,
  };
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

  if (!Array.isArray(candidate.favorites)) {
    return { valid: false, error: '"favorites" must be an array' };
  }

  for (let index = 0; index < candidate.favorites.length; index += 1) {
    const fav = candidate.favorites[index];
    if (
      !fav ||
      typeof fav !== 'object' ||
      typeof fav.id !== 'string' ||
      typeof fav.family !== 'string' ||
      !Array.isArray(fav.tags)
    ) {
      return {
        valid: false,
        error: `Favorite at index ${index} has invalid properties`,
      };
    }
  }

  if (candidate.tags !== undefined) {
    if (!Array.isArray(candidate.tags)) {
      return { valid: false, error: '"tags" must be an array' };
    }
    for (let index = 0; index < candidate.tags.length; index += 1) {
      const tag = candidate.tags[index];
      if (
        !tag ||
        typeof tag !== 'object' ||
        typeof tag.id !== 'string' ||
        typeof tag.name !== 'string'
      ) {
        return {
          valid: false,
          error: `Tag at index ${index} has invalid properties`,
        };
      }
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
      favorites: candidate.favorites as Favorite[],
      tags: (candidate.tags as Tag[]) ?? [],
      settings: candidate.settings as Partial<Settings> | undefined,
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
