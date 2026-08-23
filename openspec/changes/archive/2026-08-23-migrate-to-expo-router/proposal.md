## Why

`App.tsx` hardcodes a two-tab switcher with `useState`. That was right for two
screens, but the pantry work that follows adds roughly a dozen — a pantry list, a
detail/edit screen, three add paths, a two-stage rapid-scan flow, and later a
two-stage cooking flow. A `useState` tab index cannot express any of that.

More importantly, the project is committed to shipping a **web version**. A
hand-rolled switcher gives web users a single URL, no browser back button, and
nothing bookmarkable. Expo Router gives real URLs on web and native navigation on
device from the same file tree.

Doing this migration on its own, against the *existing* screens, keeps the
following change (which replaces the entire domain model) from also being a
navigation rewrite. The cost is briefly migrating two screens that are then
deleted; the benefit is that each change is independently reviewable and
independently revertible.

## What Changes

- Add `expo-router` and its peer dependencies, installed via `npx expo install`.
- Replace `index.ts` + `App.tsx` with an `app/` route tree.
- Move `ScanScreen` and `ListScreen` behind routes, unchanged in behaviour.
- Tab bar becomes a router layout instead of local component state.
- `app.json` gains `scheme`, the `expo-router` plugin, `web.bundler: "metro"`,
  and `experiments.typedRoutes`.
- **No user-visible behaviour changes.** Same two screens, same interactions.

## Capabilities

### New Capabilities

None. This change introduces no new behaviour.

### Modified Capabilities

None. The two existing screens keep their exact current behaviour; only the
mechanism that mounts them changes.

`skip_specs: true` is set in `.openspec.yaml`. This is a pure structural
refactor — inventing a requirement here would describe the framework, not the
product.

## Impact

**Dependencies** (all bundled in Expo Go, so no dev build required):

| Package | Why |
|---|---|
| `expo-router` | the router itself |
| `react-native-screens` | native screen primitives it builds on |
| `react-native-safe-area-context` | safe-area insets |
| `expo-linking` | deep links / URL handling |
| `expo-constants` | manifest access at runtime |

`react-native-web`, `react-dom` and `expo-status-bar` are already present.

**Files**

- Deleted: `index.ts`, `App.tsx`
- Added: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`,
  `app/(tabs)/list.tsx`
- Modified: `package.json` (`main`), `app.json`
- Unchanged: everything under `src/`

**Risks**

- `main` changing to `expo-router/entry` is the kind of edit that breaks the app
  wholesale rather than subtly. Verify on device and web before merging.
- The 7-day dependency cooldown (`minimumReleaseAge`) applies. If a required
  version is younger than that, the install fails — wait rather than adding an
  exclusion.
- `pnpm` blocks unreviewed lifecycle scripts. If the install prompts for build
  approval, that is a finding to investigate, not a prompt to click through.
