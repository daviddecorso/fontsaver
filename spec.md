# Google Fonts Favorites Extension: Starting Spec

Nov 4, 2026 · @David

## Overview

A Chrome and Firefox extension that adds a one-click heart to every font card on fonts.google.com, keeps favorites in a searchable, taggable library, and copies a ready-to-paste snippet as CSS or Fontsource.

**Goals for v1**

- One-click favorite on the browse grid and on specimen pages, with state that stays correct as the SPA re-renders
- Copy snippet in the user's chosen format: Google Fonts CSS (`<link>` or `@import`) or Fontsource (install command + import)
- Library UI with search, auto-tags (category, variable, subsets) and custom tags
- Favorites sync across the user's browsers with zero accounts or backend
- Same codebase ships to Chrome Web Store and Firefox Add-ons

**Non-goals for v1**

- Accounts, a backend, or sharing collections between people
- Applying fonts to arbitrary websites
- Fonts outside the Google Fonts catalog
- Safari (WXT supports it later if demand shows up)

## Stack Decision

WXT + TypeScript + React for extension pages, vanilla TS in the content script, WXT storage on top of `storage.sync`, and the Fontsource API as the font catalog.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | [WXT](https://wxt.dev) (v0.21.x as of Oct 2026) | File-based entrypoints, generated manifest, HMR, one build for Chrome MV3 and Firefox MV3, `wxt zip` and `wxt submit` for both stores. Actively released; Plasmo's core has been quiet since May 2025 ([comparison](https://merginit.com/blog/23082026-plasmo-vs-wxt-vs-crxjs-extension-js)) |
| Language | TypeScript, strict | Shared types across content script, pages and storage schema |
| Extension pages UI | React 19 + Tailwind v4 | Matches the team's existing React/Expo work; library page has enough state (search, tag filters, multi-select) to earn a framework |
| Content script UI | Vanilla TS in per-card shadow roots | Hundreds of cards on the grid; mounting React per card is wasteful. Shadow DOM isolates our styles from Google's and theirs from ours |
| Storage | `@wxt-dev/storage` over `storage.sync` (favorites, tags, settings) and `storage.local` (catalog cache) | Free cross-device sync with no backend; typed items with `version` + migrations from day one |
| Font catalog | [Fontsource API](https://fontsource.org/docs/api/fonts) `GET /v1/fonts?type=google` | Returns `id`, `family`, `category`, `variable`, `subsets`, `weights`, `styles`. The `id` is exactly the Fontsource package slug, so the CSS and Fontsource snippets come from one record |
| Package manager / lint | pnpm, Biome | Fast, one tool for lint + format |
| Tests | Vitest + WXT fake browser; Playwright for e2e | Unit-test snippet builders and storage; e2e loads the built extension in Chromium |

Rejected: **Plasmo** (slow core cadence), **CRXJS / raw Vite + web-ext** (more wiring for the same result), **Svelte/Solid** (smaller bundles, but React keeps the team on familiar ground and bundle size is irrelevant for an extension page).

## Architecture

Storage is the only shared state. Every context writes to it directly and subscribes with `storage.watch`, so a heart clicked on the grid updates the popup and library instantly with no message passing.

&#91;embedded content: extension architecture · 5 contexts, 2 stores, 2 external APIs\]

The background script does one job: refresh the Fontsource catalog weekly through `browser.alarms` and on install. Only the library page and popup load font files, and only for cards on screen.

## Data Model and Storage

One `storage.sync` key per favorite, so two devices editing different fonts never overwrite each other (sync resolves conflicts per key, last write wins).

```ts
// sync:fav:<fontId>  e.g. sync:fav:inter
type Favorite = {
  id: string        // Fontsource id, the canonical key
  family: string    // "Inter", kept so the UI works before the catalog loads
  addedAt: number
  tags: string[]    // custom tag ids only
  note?: string
}

// sync:tags
type Tag = { id: string; name: string; color: string }

// sync:settings
type Settings = {
  copyFormat: 'google-link' | 'google-import' | 'fontsource'
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  preferVariable: boolean
  defaultWeights: number[]   // used when a font is static
  display: 'swap' | 'optional' | 'block' | 'fallback' | 'auto'
}

// local:catalog
type Catalog = { fetchedAt: number; fonts: CatalogFont[] }  // Fontsource /v1/fonts?type=google
```

- **Auto-tags** (category, variable, subsets) are derived from the catalog at read time and never stored. Only custom tags sync.
- **Quotas.** `storage.sync` caps at 100 KB total, 8 KB per item and 512 items. That fits roughly 450 favorites plus tags and settings. Past that, show a warning and offer "store on this device only" (`local:` mirror of the same schema).
- **Catalog cache.** About 1,900 Google families; refreshed weekly by a background alarm and on demand from settings. Lives in `storage.local` (10 MB cap).
- **Schema versioning.** Every item is defined with `storage.defineItem(..., { version, migrations })` from v1 so later changes migrate in place.
- **ID mapping.** A grid card gives us the Google family name from its `/specimen/<Family>` link. Resolve to a Fontsource id through the cached catalog (`family` match), with slugify (`Open Sans` to `open-sans`) as the fallback before the catalog loads.
- **Import/export.** JSON export and import of favorites + tags from settings, so the 100 KB ceiling and browser switches never strand anyone's library.

## Features

### Grid-Level Favoriting

- Content script on `https://fonts.google.com/*` injects a heart into every font card on the browse grid and next to the family title on specimen pages.
- Find cards by `a[href^="/specimen/"]`, never by Google's class names. The href carries the family name and survives redesigns.
- A single `MutationObserver` on the results container, debounced to one animation frame, picks up new cards from infinite scroll, filter changes and SPA navigation. Each processed card gets a `data-gff` marker so it's never decorated twice.
- Each heart mounts in its own shadow root on a host `<span>`. Chrome's content-script world has no `customElements` registry, so no custom elements.
- Click is optimistic: the heart fills immediately, the write goes to storage, and every open tab and the popup update through `storage.watch`.
- `stopPropagation` + `preventDefault` on the heart so clicking it never opens the specimen page.
- Hover menu on the heart (or right-click) for quick-tag and copy snippet without leaving the grid.

### Copy Snippet

One builder module, pure functions, fully unit tested. Input: one or many favorites + settings. Output per format:

| Format | Output for Inter (variable) |
| --- | --- |
| Google `<link>` | `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` + `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">` |
| Google `@import` | `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');` |
| Fontsource | `pnpm add @fontsource-variable/inter` + `import '@fontsource-variable/inter';` + `font-family: 'Inter Variable', sans-serif;` |

- Variable fonts use axis ranges (`wght@100..900`) and `@fontsource-variable/*` when `preferVariable` is on. Static fonts use `defaultWeights` intersected with the weights the catalog says exist (`@fontsource/<id>/400.css` per weight).
- Multi-select in the library copies one combined snippet: one css2 URL with repeated `family=` params, or one install line listing every package.
- Always appends the `font-family` declaration with the catalog category as fallback (`sans-serif`, `serif`, `monospace`, `cursive` for handwriting).
- Toast confirms the copy and names the format, so a wrong setting is obvious.

### Library, Tags and Search

- **Library page** (full tab, unlisted extension page): grid of favorites rendered in their own typeface, live preview text input, size slider.
- **Popup:** recent favorites, search box, "open library" button. Kept light; the library does the heavy lifting.
- **Search:** in-memory filter over family name, custom tag names and auto-tags. A few hundred records needs no index library.
- **Filters:** chips for category, variable, custom tags; AND across groups.
- **Custom tags:** create, rename, recolor, delete from the library; assign from the library or the grid hover menu.
- **Previews** load `fonts.googleapis.com/css2` for only the visible cards (IntersectionObserver), batched into one request per scroll stop.

### Settings

Copy format, package manager, prefer variable, default weights, `font-display`, export/import JSON, refresh catalog, sync-or-local storage mode.

## Foundation

Keep all logic in `src/core` as pure TypeScript with no browser APIs; entrypoints stay thin adapters. That makes the snippet builders, ID mapping and search testable without a browser.

```text
wxt.config.ts
entrypoints/
  background.ts                  # catalog refresh alarm, install/update hooks, context menu
  google-fonts.content/
    index.ts                     # observer, card discovery, heart mounting
    heart.ts                     # shadow-root button + hover menu (vanilla)
    selectors.ts                 # every DOM assumption about fonts.google.com, in one file
  popup/      index.html, main.tsx, App.tsx
  library/    index.html, main.tsx, App.tsx   # unlisted page
  options/    index.html, main.tsx, App.tsx
src/
  core/
    snippets.ts                  # google-link, google-import, fontsource builders
    catalog.ts                   # fetch + normalize Fontsource /v1/fonts
    family-id.ts                 # Google family name -> Fontsource id
    search.ts                    # filter favorites by text, auto-tags, custom tags
    types.ts
  storage/
    items.ts                     # defineItem for settings, tags, catalog; fav:* helpers
    migrations.ts
  ui/                            # shared React components, Tailwind
tests/
  unit/                          # Vitest
  fixtures/fonts-google/         # saved HTML of grid + specimen pages
  e2e/                           # Playwright, loads .output/chrome-mv3
```

**Manifest and permissions**

- `permissions`: `storage`, `alarms`, `contextMenus`
- `host_permissions`: `https://api.fontsource.org/*` (catalog fetch)
- Content script `matches`: `https://fonts.google.com/*` only
- Firefox: set `browser_specific_settings.gecko.id` in `wxt.config.ts`; `storage.sync` requires a stable add-on ID
- No remote code, no analytics. Keeps both store reviews fast and the privacy policy one line

**Tooling**

- pnpm, TypeScript strict, Biome for lint + format, `wxt prepare` on `postinstall`
- `AGENTS.md` / `CLAUDE.md` at the root: architecture rules (core stays pure, all fonts.google.com selectors live in `selectors.ts`), commands, test expectations

**Testing**

- Unit: snippet builders (variable vs static, multi-font, every format), family-id mapping, search, migrations, using WXT's fake browser for storage
- DOM: run the content script against saved fixtures of the grid and specimen pages; assert one heart per card and no duplicates after simulated re-renders
- e2e: Playwright launches Chromium with the built extension, favorites a font on the live grid, checks the popup
- Canary: scheduled daily GitHub Action runs the live-site e2e only. A failure means Google changed the DOM; it opens an issue before users notice

**CI and release**

- PR: typecheck, Biome, Vitest, fixture tests, `wxt build -b chrome` and `-b firefox`
- Release: tag push runs `wxt zip` for both targets (Firefox also gets the sources zip AMO requires) and `wxt submit` to Chrome Web Store and Firefox Add-ons
- Versioning from `package.json`; changelog from conventional commits

## Risks and Milestones

| Risk | Mitigation |
| --- | --- |
| Google redesigns fonts.google.com and hearts disappear | Href-based selectors in one file, fixture tests, daily live canary |
| Fontsource API down or rate-limited | Cached catalog in `storage.local`; slugify fallback keeps favoriting and copy working |
| Family has no Fontsource package or differs in weights | Catalog lookup decides; Fontsource format falls back to Google CSS with a one-line notice |
| `storage.sync` quota hit | Per-key storage, warning near the cap, local-only mode, JSON export |
| Store review delays | Minimal permissions, no remote code, single-purpose description |

**Milestones**

1. Scaffold: `wxt init` with React, Biome, Vitest, CI on PRs, `AGENTS.md`
2. Core: catalog fetch + cache, family-id mapping, snippet builders with full unit coverage
3. Content script: hearts on grid + specimen pages, optimistic toggle, fixture tests
4. Popup + library: search, auto-tag filters, multi-select copy
5. Custom tags + settings page + export/import
6. Firefox pass, Playwright e2e + canary, store listings, first submission

Open questions:

- [ ] Name and icon for the store listings
- [ ] Should the library live in a Chrome side panel instead of a full tab?
- [ ] Ship the Tailwind config export (`fontFamily` entries) in v1 or later?
