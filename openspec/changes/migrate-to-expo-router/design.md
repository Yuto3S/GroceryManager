## Context

See proposal.md — Why.

Constraints that shape the approach:

- The app must keep running in **Expo Go** (AGENTS.md). Every package below is
  bundled in Expo Go, so no `expo prebuild` and no dev build.
- TypeScript is `strict` + `noUncheckedIndexedAccess`. Route names should be
  compile-time checked rather than stringly-typed.
- `pnpm run check:no-js` fails the build if any `.js`/`.jsx` file is tracked.
  Expo Router templates commonly ship `babel.config.js` — if one is needed it
  must be authored as `.ts` or the gate breaks.
- The next change deletes both screens this one migrates.

## Goals / Non-Goals

**Goals:**

- A route tree that the following changes extend by adding files, not by editing
  a switch statement.
- Real, bookmarkable URLs on web, with a working browser back button.
- Typed routes, so a renamed screen is a compile error.

**Non-Goals:**

- Any change to `src/` — state, API and lib code are untouched.
- Any new screen, or any change to how the two existing screens behave.
- Deep-link handling beyond registering a `scheme`. Nothing links into the app
  yet; wiring real entry points belongs with the features that need them.
- Auth-gated or conditional routes. There is no account model until change 8.

## Decisions

### Expo Router over React Navigation directly

React Navigation is what Expo Router is built on, so this is a question of which
layer to program against.

| | Expo Router | React Navigation |
|---|---|---|
| Web URLs | real paths, free | manual `linking` config |
| Route typing | generated, `typedRoutes` | hand-written param lists |
| New screen | add a file | register in a navigator |
| SDK 57 support | first-party, in Expo Go | supported, more assembly |

The web requirement decides it. Hand-maintaining a `linking` config that stays in
step with a growing screen tree is exactly the kind of duplicated truth that
rots, and this project's whole premise is that the web build is a first-class
target rather than an afterthought.

Note that SDK 56+ forbids importing from `@react-navigation/*` directly in app
code — Expo Router bundles it. Anything reaching for a React Navigation API is a
signal to look for the Expo Router equivalent, not to add the package back.

### `main: "expo-router/entry"` rather than a custom entry file

Expo Router supports pointing `main` at your own file that then imports
`expo-router/entry`. That indirection earns its keep when something must be
initialised before the router mounts — Sentry, a analytics SDK, a font loader.

None of that exists here. Use the direct entry, and add the indirection when
there is something to put in it.

### Route tree mirrors the eventual app, not just today's two screens

```
app/
  _layout.tsx            <GroceryProvider> + <Stack>
  (tabs)/
    _layout.tsx          the tab bar
    index.tsx            Scan   (today)  →  Pantry  (change 2)
    list.tsx             List   (today)  →  deleted (change 2)
```

`(tabs)` is a route group: parentheses mean it structures the layout without
appearing in the URL, so the tabs live at `/` and `/list` rather than
`/tabs/...`. Establishing the group now means change 2 adds `app/add/rapid.tsx`
and `app/entry/[id].tsx` as siblings without restructuring anything.

`index.tsx` is Scan today and becomes Pantry in change 2 — deliberate, because
the app's home screen changes identity but not position.

### Provider placement

`GroceryProvider` moves to the root `_layout.tsx`. It must sit above the router
outlet so state survives navigation; putting it inside a screen would remount the
store on every route change and silently reset the app.

## Risks / Trade-offs

- **Migrating screens that change 2 deletes.** → Accepted, roughly an hour of
  throwaway work. The alternative is one change that rewrites both navigation and
  the entire domain model, which is far harder to review or revert.

- **`main` is an all-or-nothing edit.** A wrong entry point does not degrade, it
  white-screens. → Verify on device *and* web before merging; this is the one
  change where "it typechecks" proves nothing.

- **Dependency cooldown may block the install.** `minimumReleaseAge: 10080`
  applies to every resolved version. → If a version is too young, wait for it to
  age. Do not add a `minimumReleaseAgeExclude` entry — those exist only to
  grandfather the npm→pnpm migration and are meant to shrink, not grow.

- **`strictDepBuilds` may flag a lifecycle script.** Five new packages plus
  transitives. → Per AGENTS.md, an approval prompt is a finding to investigate,
  not a prompt to accept.

- **`check:no-js` vs. generated config.** → If Expo Router requires a Babel
  config, author it as `babel.config.ts`. If it can only be `.js`, that is a real
  conflict with a committed CI gate and needs a decision before merging, not a
  quiet `.gitignore` entry.

## Migration Plan

1. `npx expo install expo-router react-native-screens react-native-safe-area-context expo-linking expo-constants`
2. `app.json`: add `scheme`, `plugins: ["expo-router"]`, `web.bundler: "metro"`,
   `experiments.typedRoutes: true`
3. `package.json`: `main` → `expo-router/entry`
4. Create the `app/` tree; move the tab bar from `App.tsx` into
   `app/(tabs)/_layout.tsx`
5. Delete `index.ts` and `App.tsx`
6. `npx expo start --clear` — the bundler cache holds the old entry point and
   will otherwise serve a stale graph
7. Verify: both tabs on iOS Expo Go; both tabs on web; browser back button;
   `pnpm run check` clean

Rollback is `git revert` — no persisted data or schema is touched.
