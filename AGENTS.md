# Project: Grocery Scanner (Expo / React Native)

A barcode-scanning grocery-list app. Scan a product → look it up on Open Food
Facts → add to a list → check off as bought. See README.md for the full tour.

## Ground rules for changes

- **Expo SDK 57 / React Native 0.86 / React 19.** APIs move fast — check the
  versioned docs at https://docs.expo.dev/versions/v57.0.0/ before adding libs.
- Barcode scanning uses **`expo-camera`** (`CameraView` + `onBarcodeScanned`),
  not the deprecated `expo-barcode-scanner`.
- Persistence is **AsyncStorage**, wrapped in `src/state/GroceryStore.js`.
  Add new persisted fields there; don't scatter storage calls around.
- Keep the app runnable in **Expo Go** (no custom native modules) unless the
  user explicitly wants to move to a dev build.
- To fix version mismatches, use `npx expo install --fix`, not manual bumps.

## Dependency policy

- **Package manager is pnpm.** `nodeLinker: hoisted` in `pnpm-workspace.yaml`
  is required — Metro doesn't reliably follow pnpm's symlinked store, and
  `create-expo-app` defaults pnpm projects to hoisted for that reason.
- **7-day cooldown**, enforced by `minimumReleaseAge: 10080` (minutes) in
  `pnpm-workspace.yaml`. pnpm applies it to transitive dependencies at
  resolution and re-checks every lockfile entry on install, so there is no
  wrapper script to remember and nothing custom to maintain.
- `minimumReleaseAgeExclude` in that file was written by pnpm during the
  npm→pnpm migration to grandfather 8 already-pinned Expo versions. Entries are
  pinned to exact versions, so they don't cover future releases. Prune them once
  each version has aged past the cooldown; see SECURITY.md.
- pnpm blocks dependency lifecycle scripts by default (`strictDepBuilds`), so
  an install *fails* on unreviewed build scripts. If pnpm ever asks you to
  approve a build, treat that as a finding, not a prompt to click through.
- Accepted advisories live in `audit.ignore` in `pnpm-workspace.yaml`; run
  `pnpm audit`. Never add a git dependency — the pre-commit hook rejects any
  lockfile entry that isn't resolved by integrity hash.
- Reproducible installs use `pnpm install --frozen-lockfile`, which fails
  rather than re-resolving. Commit `package.json` and `pnpm-lock.yaml` together.
- Never run `npm audit fix --force`: it "fixes" the two accepted advisories by
  downgrading to `expo@53`. Rationale in SECURITY.md.
- Open Food Facts data is untrusted (anyone can edit it). Normalize it in
  `src/api/openFoodFacts.js`; image URLs must be `https://` only.
- **Never install a git/GitHub dependency.** Registry tarballs don't run their
  `prepare` scripts; git dependencies do. Every package must resolve to
  `registry.npmjs.org` — 46 packages in this tree ship a `prepare`/`prepack`
  script that stays dormant only because of that.
- These verification commands are pre-approved, run them freely:
  `pnpm test`, `pnpm run lint`, `pnpm run lint:fix`, `pnpm audit`.
  Ask before invoking any other package executable. Running the app
  (`pnpm exec expo start`) is fine when the user asks to see it working.

## Testing

- `npm test` runs Jest via the `jest-expo` preset. Unit tests only for now —
  E2E was deferred; see SECURITY.md and the note below on Detox.
- Pure, security-relevant logic lives in `src/lib/` precisely so it's testable
  without a native build: `barcode.js` (what we're willing to send to Open Food
  Facts) and `cache.js` (bounding the offline cache).
- `react-test-renderer` is deprecated and doesn't support React 19 — use
  `@testing-library/react-native` for component tests.
- **Detox is not an option while the app targets Expo Go.** It needs the native
  `ios/`/`android/` projects, so it requires `expo prebuild`. That would also
  invalidate the SECURITY.md rationale for accepting GHSA-w5hq-g745-h8pq, which
  rests on prebuild never running. Expo documents Maestro for E2E; it still
  needs a dev build but adds no npm packages.

## Code style

- **Biome** does linting, formatting and import sorting — one tool, config in
  `biome.json`. `npm run lint` to check, `npm run lint:fix` to fix.
- Chosen over ESLint + Prettier deliberately: it's ~2 packages with no install
  scripts, so pnpm's `strictDepBuilds` gate stays happy. The trade-off is no
  React Native-specific rules, which `eslint-config-expo` would have given.
- Biome's default `indentStyle` is `tab`; this codebase uses 2 spaces. Keep
  `"indentStyle": "space"` in `biome.json` or every file will churn.
- The pre-commit hook reports Biome findings but never rewrites files
  mid-commit.

## Architecture

- `src/state/GroceryStore.js` — single source of truth (reducer + context).
  All list mutations and the offline product cache live here.
- `src/api/openFoodFacts.js` — the only place that talks to the network.
- Screens are presentational and read/write through the `useGrocery()` hook.

## Quick start

```bash
npm install
npx expo start   # then scan the QR with Expo Go
```
