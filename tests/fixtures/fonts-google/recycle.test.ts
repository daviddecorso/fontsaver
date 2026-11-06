import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scanAndDecorate } from '../../../entrypoints/google-fonts.content/index';

describe('heart lifecycle when Google recycles elements', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML =
      '<main><ul><li id="card"><a id="link" href="/specimen/Roboto">Roboto</a></li></ul></main>';
  });

  const hearts = () => document.querySelectorAll('[data-gff-heart]');

  it('does not duplicate hearts on repeated scans', () => {
    scanAndDecorate();
    scanAndDecorate();
    expect(hearts()).toHaveLength(1);
  });

  it('replaces the heart when the card now shows a different family', () => {
    scanAndDecorate();
    document.getElementById('link')?.setAttribute('href', '/specimen/Lato');
    scanAndDecorate();

    expect(hearts()).toHaveLength(1);
    expect(hearts()[0]?.getAttribute('data-gff-heart')).toBe('Lato');
  });

  it('remounts a heart whose host was removed from the DOM', () => {
    scanAndDecorate();
    hearts()[0]?.remove();
    scanAndDecorate();

    expect(hearts()).toHaveLength(1);
  });
});
