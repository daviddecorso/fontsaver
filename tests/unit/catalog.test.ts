import { describe, expect, it } from 'vitest';
import { fetchCatalog } from '../../src/core/catalog';

describe('fetchCatalog', () => {
  it('fetches and maps catalog data', async () => {
    const mockData = [
      {
        id: 'inter',
        family: 'Inter',
        category: 'sans-serif',
        variable: true,
        subsets: ['latin', 'latin-ext'],
        weights: [100, 400, 700],
        styles: ['normal', 'italic'],
      },
    ];

    const mockFetch = async () =>
      ({
        ok: true,
        statusText: 'OK',
        json: async () => mockData,
      }) as unknown as Response;

    const catalog = await fetchCatalog(mockFetch as unknown as typeof fetch);

    expect(catalog.fetchedAt).toBeGreaterThan(0);
    expect(catalog.fonts).toHaveLength(1);
    expect(catalog.fonts[0]).toEqual({
      id: 'inter',
      family: 'Inter',
      category: 'sans-serif',
      variable: true,
      subsets: ['latin', 'latin-ext'],
      weights: [100, 400, 700],
      styles: ['normal', 'italic'],
    });
  });

  it('applies fallback defaults for optional properties', async () => {
    const mockData = [
      {
        id: 'custom-font',
        family: 'Custom Font',
      },
    ];

    const mockFetch = async () =>
      ({
        ok: true,
        statusText: 'OK',
        json: async () => mockData,
      }) as unknown as Response;

    const catalog = await fetchCatalog(mockFetch as unknown as typeof fetch);

    expect(catalog.fonts[0]).toEqual({
      id: 'custom-font',
      family: 'Custom Font',
      category: 'sans-serif',
      variable: false,
      subsets: [],
      weights: [400],
      styles: ['normal'],
    });
  });

  it('throws when response is not ok', async () => {
    const mockFetch = async () =>
      ({
        ok: false,
        statusText: 'Service Unavailable',
        json: async () => ({}),
      }) as unknown as Response;

    await expect(
      fetchCatalog(mockFetch as unknown as typeof fetch),
    ).rejects.toThrow('Failed to fetch catalog: Service Unavailable');
  });
});
