## 1. Install dependencies

- [ ] 1.1 `npx expo install expo-router react-native-screens react-native-safe-area-context expo-linking expo-constants`
- [ ] 1.2 Confirm the install did not trigger a `strictDepBuilds` approval prompt.
      If it did, stop and investigate which package ships a lifecycle script —
      per AGENTS.md that is a finding, not a prompt to accept.
- [ ] 1.3 Confirm every new entry in `pnpm-lock.yaml` resolves to
      `registry.npmjs.org` with an integrity hash.
- [ ] 1.4 `pnpm audit` — no new advisories.

## 2. Configuration

- [ ] 2.1 `app.json`: add `expo.scheme` (e.g. `"groceryscanner"`)
- [ ] 2.2 `app.json`: add `"plugins": ["expo-router"]`
- [ ] 2.3 `app.json`: add `"web": { "bundler": "metro" }`
- [ ] 2.4 `app.json`: add `"experiments": { "typedRoutes": true }`
- [ ] 2.5 `package.json`: `"main": "expo-router/entry"`
- [ ] 2.6 If a Babel config is required, author it as `babel.config.ts`.
      If only `.js` is accepted, stop — `pnpm run check:no-js` is a committed CI
      gate and this needs a decision, not a workaround.

## 3. Route tree

- [ ] 3.1 `app/_layout.tsx` — `<GroceryProvider>` wrapping a `<Stack>`, plus
      `<StatusBar>`. Provider must sit above the outlet so navigation does not
      remount the store.
- [ ] 3.2 `app/(tabs)/_layout.tsx` — port the tab bar from `App.tsx`, including
      the unbought-count badge that reads `useGrocery()`
- [ ] 3.3 `app/(tabs)/index.tsx` — renders `ScanScreen`
- [ ] 3.4 `app/(tabs)/list.tsx` — renders `ListScreen`
- [ ] 3.5 Delete `index.ts` and `App.tsx`
- [ ] 3.6 Confirm no file under `src/` was modified

## 4. Verify

- [ ] 4.1 `npx expo start --clear` (the cache holds the old entry point)
- [ ] 4.2 iOS via Expo Go: both tabs render, scanning still works, the badge
      still counts
- [ ] 4.3 Web: both tabs render; `/` and `/list` are real URLs; browser back
      moves between them
- [ ] 4.4 `pnpm run check` clean (`check:no-js`, `typecheck`, `lint`)
- [ ] 4.5 `pnpm test` green — no test should have needed changing, since `src/`
      is untouched. If one did, that is a signal the refactor leaked.
