import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Google Fonts Favorites',
    description:
      'Favorite Google Fonts, keep a searchable library, and copy ready-to-paste snippets.',
    permissions: ['storage', 'alarms', 'contextMenus'],
    host_permissions: ['https://api.fontsource.org/*'],
    browser_specific_settings: {
      gecko: {
        id: 'google-fonts-favorites@extension',
      },
    },
  },
});
