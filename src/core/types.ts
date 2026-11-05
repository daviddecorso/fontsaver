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

export interface Settings {
  copyFormat: CopyFormat;
  packageManager: PackageManager;
  preferVariable: boolean;
  defaultWeights: number[];
  display: FontDisplay;
}

export interface Catalog {
  fetchedAt: number;
  fonts: CatalogFont[];
}
