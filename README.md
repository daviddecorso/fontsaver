# Fontsaver

A Chrome and Firefox extension that adds a one-click heart to every font on [fonts.google.com](https://fonts.google.com), keeps your favorites in a searchable library, and copies a ready-to-paste snippet for whichever setup you use.

No accounts, no backend, no analytics.

## Features

- **Heart any font** on the browse grid and on specimen pages. The state stays correct as the site re-renders.
- **Library** of your favorites, rendered in their own typefaces, with a live preview text box and size slider.
- **Search and filter** by name, category, variable fonts, subsets, and your own tags.
- **Custom tags and notes** to organize fonts by project.
- **Copy snippets** in the format you pick in Settings:
  - Google Fonts `<link>` or `@import`
  - Fontsource (install command, import, and `font-family`)
  - Tailwind v3 / v4
  - `next/font`
- **Multi-select copy** combines several fonts into one snippet.
- **Sync across browsers** through your browser's built-in extension sync, or keep everything on-device only.
- **Export / import** your favorites and tags as JSON.
- Popup, side panel (Chrome), and right-click context menu for quick access.

## Privacy

Everything is stored in your browser. The extension fetches the public font catalog from `api.fontsource.org` and loads font previews from Google Fonts. No personal data is collected or sent anywhere. See [PRIVACY.md](PRIVACY.md).

## Development

Built with [WXT](https://wxt.dev), TypeScript, React 19 and Tailwind v4. The content script is vanilla TypeScript that injects the heart into a shadow root per card.

```bash
pnpm install
pnpm dev              # Chrome, with HMR
pnpm dev:firefox
```

Build and package:

```bash
pnpm build            # Chrome MV3 -> .output/chrome-mv3
pnpm build:firefox
pnpm zip              # store-ready zip
pnpm zip:firefox
```

To load an unpacked build in Chrome, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** on `.output/chrome-mv3`.

Checks:

```bash
pnpm check            # lint + format (Biome)
pnpm typecheck
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # Playwright against .output/chrome-mv3 (build first)
```

### Layout

- `src/core/`: pure TypeScript (snippet builders, search, tags, import/export). No browser APIs.
- `entrypoints/`: thin adapters for the background worker, content script, popup, library, side panel and options page.
- `entrypoints/google-fonts.content/selectors.ts`: every DOM assumption about fonts.google.com lives here, so a site change is a one-file fix.
- `tests/`: unit tests, saved HTML fixtures of fonts.google.com, and e2e tests.

## Contributing

Issues and pull requests are welcome. Please run `pnpm check`, `pnpm typecheck` and `pnpm test` before opening a PR.

## Disclaimer

Not affiliated with or endorsed by Google. Google Fonts is a trademark of Google LLC.
