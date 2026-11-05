import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '../../src/storage/items';

describe('storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('reads default settings and writes updates', async () => {
    const settings = await settingsItem.getValue();
    expect(settings.copyFormat).toBe('google-link');

    await settingsItem.setValue({
      ...settings,
      copyFormat: 'fontsource',
    });

    const updated = await settingsItem.getValue();
    expect(updated.copyFormat).toBe('fontsource');
  });
});
