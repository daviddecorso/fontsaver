import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: (env) => ({
    name: 'Google Fonts Favorites',
    description:
      'Favorite Google Fonts, keep a searchable library, and copy ready-to-paste snippets.',
    permissions: [
      'storage',
      'alarms',
      'contextMenus',
      ...(env.browser === 'firefox' ? [] : ['sidePanel']),
    ],
    host_permissions: ['https://api.fontsource.org/*'],
    browser_specific_settings: {
      gecko: {
        id: 'google-fonts-favorites@extension',
        data_collection_permissions: { required: ['none'] },
      },
    },
  }),
});
