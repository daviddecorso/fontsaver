export interface CatalogFont {
  id: string;
  family: string;
  category: string;
  variable: boolean;
  subsets: string[];
  weights: number[];
  styles: string[];
}

export interface Favorite {
  id: string;
  family: string;
  addedAt: number;
  tags: string[];
  note?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type CopyFormat = 'google-link' | 'google-import' | 'fontsource';
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';
export type FontDisplay = 'swap' | 'optional' | 'block' | 'fallback' | 'auto';
export type StorageMode = 'sync' | 'local';

export interface Settings {
  copyFormat: CopyFormat;
  packageManager: PackageManager;
  preferVariable: boolean;
  defaultWeights: number[];
  display: FontDisplay;
  storageMode?: StorageMode;
}

export interface ExportData {
  version: number;
  exportedAt: number;
  favorites: Favorite[];
  tags: Tag[];
  settings?: Partial<Settings>;
}

export interface Catalog {
  fetchedAt: number;
  fonts: CatalogFont[];
}

export interface StorageQuotaStats {
  bytesUsed: number;
  totalBytes: number;
  itemCount: number;
  maxItems: number;
  percentUsed: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

export interface FilterOptions {
  query?: string;
  category?: string;
  variableOnly?: boolean;
  subsets?: string[];
  tagIds?: string[];
}
