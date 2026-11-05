# Claude Guidelines

## Architecture Rules

- Keep all core logic in `src/core/` as pure TypeScript with no browser or extension APIs.
- Entrypoints in `entrypoints/` must remain thin adapters.
- All DOM assumptions and selectors for `fonts.google.com` must live in `entrypoints/google-fonts.content/selectors.ts`. Never use Google's generated CSS classes.
- Use `@wxt-dev/storage` directly for state synchronization (`storage.sync` and `storage.local`).
- Content script injects a vanilla TS button into shadow roots per card; avoid mounting full React apps in content script.

## Commands

Prefer `vp` (Vite+) or `pnpm`:

- Install dependencies: `vp install` or `pnpm install`
- Start dev server: `vp run dev` or `pnpm dev`
- Build Chrome MV3: `vp run build` or `pnpm build`
- Build Firefox MV3: `vp run build:firefox` or `pnpm build:firefox`
- Typecheck: `vp run typecheck` or `pnpm typecheck`
- Lint: `vp run lint` or `pnpm lint`
- Format: `vp run format` or `pnpm format`
- Check (lint + format): `vp check` or `pnpm check`
- Unit tests: `vp test` or `pnpm test`
- E2E tests: `vp run test:e2e` or `pnpm test:e2e`

## Testing Expectations

- Unit tests in `tests/unit/` using Vitest and WXT fake browser.
- DOM tests against saved HTML fixtures in `tests/fixtures/fonts-google/`.
- Playwright E2E tests in `tests/e2e/` against `.output/chrome-mv3`.
