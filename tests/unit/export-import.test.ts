import { describe, expect, it } from 'vitest';
import {
  calculateStorageUsage,
  createExportPayload,
  mergeFavorites,
  mergeTags,
  SYNC_MAX_ITEMS,
  SYNC_QUOTA_BYTES,
  validateExportData,
} from '../../src/core/export-import';
import type { Favorite, Settings, Tag } from '../../src/core/types';

describe('export-import core utilities', () => {
  const sampleSettings: Settings = {
    copyFormat: 'google-link',
    packageManager: 'pnpm',
    preferVariable: true,
    defaultWeights: [400, 700],
    display: 'swap',
    storageMode: 'sync',
  };

  const sampleFavorites: Favorite[] = [
    {
      id: 'inter',
      family: 'Inter',
      addedAt: 1000,
      tags: ['ui', 'work'],
    },
    {
      id: 'roboto',
      family: 'Roboto',
      addedAt: 500,
      tags: ['body'],
    },
  ];

  const sampleTags: Tag[] = [
    { id: 'ui', name: 'UI', color: '#1a73e8' },
    { id: 'work', name: 'Work', color: '#34a853' },
  ];

  it('creates an export payload with timestamp and data', () => {
    const payload = createExportPayload(
      sampleFavorites,
      sampleTags,
      sampleSettings,
    );
    expect(payload.version).toBe(1);
    expect(typeof payload.exportedAt).toBe('number');
    expect(payload.favorites).toHaveLength(2);
    expect(payload.tags).toHaveLength(2);
    expect(payload.settings?.packageManager).toBe('pnpm');
  });

  it('validates a valid export payload', () => {
    const payload = createExportPayload(sampleFavorites, sampleTags);
    const result = validateExportData(payload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.favorites).toHaveLength(2);
    }
  });

  it('rejects invalid export data structures', () => {
    expect(validateExportData(null).valid).toBe(false);
    expect(validateExportData('string').valid).toBe(false);
    expect(validateExportData({}).valid).toBe(false);
    expect(validateExportData({ version: '1', favorites: [] }).valid).toBe(
      false,
    );
    expect(
      validateExportData({ version: 1, favorites: 'not-array' }).valid,
    ).toBe(false);
    expect(
      validateExportData({
        version: 1,
        favorites: [{ id: 'roboto' }], // missing family & tags
      }).valid,
    ).toBe(false);
    expect(
      validateExportData({
        version: 1,
        favorites: [],
        tags: [{ name: 'only' }], // missing id
      }).valid,
    ).toBe(false);
  });

  it('merges favorites correctly preserving unique tags and recent timestamp', () => {
    const existing: Favorite[] = [
      { id: 'inter', family: 'Inter', addedAt: 1000, tags: ['ui'] },
      { id: 'roboto', family: 'Roboto', addedAt: 500, tags: ['sans'] },
    ];

    const incoming: Favorite[] = [
      {
        id: 'inter',
        family: 'Inter',
        addedAt: 2000,
        tags: ['web'],
        note: 'Header font',
      },
      { id: 'fira-code', family: 'Fira Code', addedAt: 1500, tags: ['mono'] },
    ];

    const merged = mergeFavorites(existing, incoming);
    expect(merged).toHaveLength(3);

    const inter = merged.find((f) => f.id === 'inter');
    expect(inter?.addedAt).toBe(2000);
    expect(inter?.tags.sort()).toEqual(['ui', 'web']);
    expect(inter?.note).toBe('Header font');

    expect(merged[0]?.id).toBe('inter');
    expect(merged[1]?.id).toBe('fira-code');
    expect(merged[2]?.id).toBe('roboto');
  });

  it('merges tags by id correctly', () => {
    const existing: Tag[] = [
      { id: 'ui', name: 'UI Old', color: '#000' },
      { id: 'brand', name: 'Brand', color: '#111' },
    ];
    const incoming: Tag[] = [
      { id: 'ui', name: 'UI New', color: '#fff' },
      { id: 'mono', name: 'Monospace', color: '#222' },
    ];

    const merged = mergeTags(existing, incoming);
    expect(merged).toHaveLength(3);
    const ui = merged.find((t) => t.id === 'ui');
    expect(ui?.name).toBe('UI New');
    expect(ui?.color).toBe('#fff');
  });

  it('calculates storage usage and detects quota thresholds', () => {
    const smallSnapshot: Record<string, unknown> = {
      'fav:inter': { id: 'inter', family: 'Inter', addedAt: 1234, tags: [] },
      'sync:settings': sampleSettings,
    };

    const usage = calculateStorageUsage(smallSnapshot);
    expect(usage.itemCount).toBe(2);
    expect(usage.bytesUsed).toBeGreaterThan(0);
    expect(usage.isNearLimit).toBe(false);
    expect(usage.isOverLimit).toBe(false);

    // Simulate near item limit
    const crowdedSnapshot: Record<string, unknown> = {};
    for (let i = 0; i < Math.floor(SYNC_MAX_ITEMS * 0.85); i += 1) {
      crowdedSnapshot[`fav:${i}`] = { id: `${i}` };
    }
    const crowdedUsage = calculateStorageUsage(crowdedSnapshot);
    expect(crowdedUsage.isNearLimit).toBe(true);

    // Simulate over byte limit
    const largeSnapshot: Record<string, unknown> = {
      'fav:huge': 'x'.repeat(SYNC_QUOTA_BYTES + 10),
    };
    const largeUsage = calculateStorageUsage(largeSnapshot);
    expect(largeUsage.isOverLimit).toBe(true);
  });
});
