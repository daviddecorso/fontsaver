import type { Catalog, CatalogFont } from './types';

const FONTSOURCE_API_URL = 'https://api.fontsource.org/v1/fonts?type=google';

export async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch(FONTSOURCE_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.statusText}`);
  }
  const rawFonts = (await response.json()) as Array<{
    id: string;
    family: string;
    category?: string;
    variable?: boolean;
    subsets?: string[];
    weights?: number[];
    styles?: string[];
  }>;

  const fonts: CatalogFont[] = rawFonts.map((f) => ({
    id: f.id,
    family: f.family,
    category: f.category ?? 'sans-serif',
    variable: Boolean(f.variable),
    subsets: f.subsets ?? [],
    weights: f.weights ?? [400],
    styles: f.styles ?? ['normal'],
  }));

  return {
    fetchedAt: Date.now(),
    fonts,
  };
}
