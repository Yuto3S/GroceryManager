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

- **7-day cooldown.** Never install a package version published less than 7
  days ago — that's the window in which most compromised releases get caught
  and unpublished. Add packages with `npm run add -- <package>` (wraps
  `npm install --before=<7 days ago> --ignore-scripts`), not bare
  `npm install <package>`. Verify with `npm run deps:age`.
- `npx expo install` does **not** honour the cooldown — it resolves against
  Expo's SDK manifest and calls npm itself. That's an accepted exception for
  Expo-owned packages; apply the cooldown to everything else.
- Reproducible installs use `npm ci`, which installs exactly what the lockfile
  pins. Commit `package.json` and `package-lock.json` together.
- `npm audit` has two known, accepted findings — run `npm run audit:check`
  instead, which fails only on new ones. Never run `npm audit fix --force`: it
  "fixes" them by downgrading to `expo@53`. Rationale in SECURITY.md.
- Open Food Facts data is untrusted (anyone can edit it). Normalize it in
  `src/api/openFoodFacts.js`; image URLs must be `https://` only.
- **Never install a git/GitHub dependency.** Registry tarballs don't run their
  `prepare` scripts; git dependencies do. Every package must resolve to
  `registry.npmjs.org` — 46 packages in this tree ship a `prepare`/`prepack`
  script that stays dormant only because of that.
- Don't invoke package-provided executables (`npx <tool>`) to check your work;
  ask first. Running the app itself (`npx expo start`) is the exception, since
  there's no other way to exercise it.

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
