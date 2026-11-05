import { describe, expect, it } from 'vitest';
import { familyNameToFontId, slugifyFamily } from '../../src/core/family-id';

describe('family-id', () => {
  it('slugifies family names', () => {
    expect(slugifyFamily('Open Sans')).toBe('open-sans');
    expect(slugifyFamily('Playfair+Display')).toBe('playfair-display');
  });

  it('matches catalog font if present', () => {
    const catalog = [
      {
        id: 'roboto',
        family: 'Roboto',
        category: 'sans-serif',
        variable: true,
        subsets: ['latin'],
        weights: [400, 700],
        styles: ['normal'],
      },
    ];
    expect(familyNameToFontId('Roboto', catalog)).toBe('roboto');
    expect(familyNameToFontId('Roboto Serif', catalog)).toBe('roboto-serif');
  });
});
