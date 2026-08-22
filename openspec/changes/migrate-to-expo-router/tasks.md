## 1. Install dependencies

- [x] 1.1 `npx expo install expo-router react-native-screens react-native-safe-area-context expo-linking expo-constants`
- [x] 1.2 Confirm the install did not trigger a `strictDepBuilds` approval prompt.
      If it did, stop and investigate which package ships a lifecycle script —
      per AGENTS.md that is a finding, not a prompt to accept.
- [x] 1.3 Confirm every new entry in `pnpm-lock.yaml` resolves to
      `registry.npmjs.org` with an integrity hash.
- [x] 1.4 `pnpm audit` — no new advisories.

## 2. Configuration

- [x] 2.1 `app.json`: add `expo.scheme` (e.g. `"groceryscanner"`)
- [x] 2.2 `app.json`: add `"plugins": ["expo-router"]`
- [x] 2.3 `app.json`: add `"web": { "bundler": "metro" }`
- [x] 2.4 `app.json`: add `"experiments": { "typedRoutes": true }`
- [x] 2.5 `package.json`: `"main": "expo-router/entry"`
- [x] 2.6 If a Babel config is required, author it as `babel.config.ts`.
      If only `.js` is accepted, stop — `pnpm run check:no-js` is a committed CI
      gate and this needs a decision, not a workaround.

## 3. Route tree

- [x] 3.1 `app/_layout.tsx` — `<GroceryProvider>` wrapping a `<Stack>`, plus
      `<StatusBar>`. Provider must sit above the outlet so navigation does not
      remount the store.
- [x] 3.2 `app/(tabs)/_layout.tsx` — port the tab bar from `App.tsx`, including
      the unbought-count badge that reads `useGrocery()`
- [x] 3.3 `app/(tabs)/index.tsx` — renders `ScanScreen`
- [x] 3.4 `app/(tabs)/list.tsx` — renders `ListScreen`
- [x] 3.5 Delete `index.ts` and `App.tsx`
- [x] 3.6 Confirm no file under `src/` was modified — **one exception, accepted.**
      `src/api/__tests__/openFoodFacts.test.ts` needed its `fetch` mock retyped.
      Not a leak from the refactor: `fetch` is declared three times in this
      program (lib.dom, `@types/node` via `@jest/globals`, and React Native's
      own `globals.d.ts`), and `jest.fn<typeof fetch>()` resolves against
      whichever declaration TypeScript loaded *last*. `App.tsx` was the first
      root file, so deleting it in 3.5 reshuffled that order and React Native's
      narrower `(input: RequestInfo)` landed last. Verified by holding `src/`
      and `tsconfig.json` at HEAD and removing `app/` entirely — `tsc
      --listFiles` shows expo-router absent from the program, and it still
      fails. The fix names the one signature the test uses rather than
      inheriting whichever overload wins. Behaviour unchanged.
      Alternatives rejected: `"types": []` does not help (`@types/node` arrives
      through a `/// <reference types="node" />` in `@jest/environment`, which
      that setting does not block), and excluding tests from `tsc` would trade
      real type coverage for a green checkbox.

## 4. Verify

- [x] 4.1 `npx expo start --clear` (the cache holds the old entry point)
- [ ] 4.2 iOS via Expo Go: both tabs render, scanning still works, the badge
      still counts
- [ ] 4.3 Web: both tabs render; `/` and `/list` are real URLs; browser back
      moves between them
- [x] 4.4 `pnpm run check` clean (`check:no-js`, `typecheck`, `lint`)
- [x] 4.5 `pnpm test` green — 38/38. One test *did* change, and the signal was
      worth following: it pointed at ambient-type ordering, not at the refactor.
      See 3.6 for the diagnosis and why the change was accepted.
