# Project: Grocery Scanner (Expo / React Native)

A home pantry inventory. Scan a product (or type a name) → look it up on Open
Food Facts → record how much of it you have and where it is kept → tap it down
as you cook. See README.md for the full tour.

The shopping list this started as is gone: `bought` has no meaning in an
inventory. Re-buy suggestions return later, built on real consumption data.

## Ground rules for changes

- **Expo SDK 57 / React Native 0.86 / React 19.** APIs move fast — check the
  versioned docs at https://docs.expo.dev/versions/v57.0.0/ before adding libs.
- **The codebase is TypeScript**, `strict` plus `noUncheckedIndexedAccess`.
  There are no `.js`/`.jsx` files left and `pnpm run check:no-js` keeps it that
  way. Pin `typescript` to what the SDK expects (`~6.0.3` for SDK 57), not to
  npm `latest` — TypeScript 7 is out and ahead of Expo.
- Barcode scanning uses **`expo-camera`** (`CameraView` + `onBarcodeScanned`),
  not the deprecated `expo-barcode-scanner`.
- **Scanning on web is gated on a real capability check.** `expo-camera` falls
  back to a WASM polyfill (`barcode-detector` → `zxing-wasm`) whose default
  `locateFile` fetches the engine from jsdelivr at runtime — outside every
  control in SECURITY.md, and it breaks the offline guarantee. So
  `src/lib/scanning.ts` offers scanning only where the browser has a native
  `BarcodeDetector`. Note the check is `getSupportedFormats()`, not `typeof
  BarcodeDetector`: the constructor can exist while the platform behind it reads
  nothing, which is what "partial support" means for desktop Chrome.
- Persistence is **AsyncStorage**, wrapped in `src/state/PantryStore.tsx`.
  Add new persisted fields there; don't scatter storage calls around. The
  reducer underneath it (`src/state/pantryReducer.ts`) is pure — no React, no
  storage, no clock, no id generator. `now` and fresh UUIDs arrive on the
  action, which is what makes it testable without rendering anything.
- Keep the app runnable in **Expo Go** (no custom native modules) unless the
  user explicitly wants to move to a dev build.
- To fix version mismatches, use `npx expo install --fix`, not manual bumps.

## Spec-driven changes (OpenSpec)

- Non-trivial work goes through **OpenSpec**: agree the spec before writing
  code. `/opsx:propose "<idea>"` creates a change and its artifacts;
  `/opsx:apply` implements it. `/opsx:explore` is the thinking-partner step for
  when the requirement isn't clear yet, `/opsx:update` revises a proposal,
  `/opsx:sync` folds delta specs into the main specs, and `/opsx:archive`
  closes a finished change.
- Specs and proposals live under `openspec/`. Each change carries
  `proposal.md`, `design.md`, `tasks.md` and a `specs/` delta. **Commit them** —
  they're the living record of why a change looks the way it does.
- `.claude/skills/openspec-*/` and `.claude/commands/opsx/` are **generated**
  (`generatedBy` is in their frontmatter). Don't hand-edit them, because
  `openspec update` rewrites them wholesale. Project-specific guidance belongs
  in `openspec/config.yaml` (`context:`, `rules:`, `operations:`), which is
  hand-maintained and currently all commented-out scaffolding.
- `openspec validate --all` before archiving; `openspec doctor` if the tool
  starts behaving oddly.
- The CLI is installed **globally**, not as a devDependency — deliberately, to
  keep a dev-only tool out of `pnpm-lock.yaml`. The trade-off is that none of
  the dependency controls below apply to it; see "Tooling outside the
  dependency policy" in SECURITY.md before upgrading it.
- Telemetry ships **on** and has been turned **off** (`telemetry.enabled` in
  `~/.config/openspec/config.json`). Leave it off.

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
  `src/api/openFoodFacts.ts`; image URLs must be `https://` only. **A backup
  file being imported is untrusted on exactly the same terms** — it can be
  hand-edited, truncated by a transfer, or be some other JSON file entirely.
  `parseBackup` checks it field by field. A structural failure rejects the whole
  document; one malformed record is dropped and *reported*, because rejecting a
  hundred-item backup over one bad entry would cost the user their pantry.
- **Types are not validation.** `res.json()` is typed `unknown` and stays that
  way until `isRecord`/`asString` have checked it. Annotating the response as a
  `Product` would be an assertion, not a check, and would let a vandalized
  record through with the type system vouching for it. Never widen that.
- **Never install a git/GitHub dependency.** Registry tarballs don't run their
  `prepare` scripts; git dependencies do. Every package must resolve to
  `registry.npmjs.org` — 46 packages in this tree ship a `prepare`/`prepack`
  script that stays dormant only because of that.
- These verification commands are pre-approved, run them freely:
  `pnpm test`, `pnpm run lint`, `pnpm run lint:fix`, `pnpm run typecheck`,
  `pnpm run check:no-js`, `pnpm run check`, `pnpm audit`, and `openspec` (any
  subcommand — the allowlist rule is `Bash(openspec:*)`). They are all
  read-only, and the list lives in `.claude/settings.json`, which is committed —
  so it applies to everyone who clones, not just the machine that added it.
  Ask before invoking any other package executable. Running the app
  (`pnpm exec expo start`) is fine when the user asks to see it working.

## Testing

- `pnpm test` runs Jest via the `jest-expo` preset. Unit tests only for now —
  E2E was deferred; see SECURITY.md and the note below on Detox.
- Tests are `.ts` and import their globals from **`@jest/globals`** rather than
  relying on ambient types. That's a deliberate dependency choice: `@types/jest`
  would be another package to keep in step with Jest, and `@jest/globals` ships
  with Jest itself.
- Pure logic lives in `src/lib/` precisely so it's testable without a native
  build: `barcode.ts` (what we're willing to send to Open Food Facts),
  `cache.ts` (bounding the offline cache), `quantity.ts` (parsing untrusted
  quantity text), `identity.ts` (stable catalogue keys), `merge.ts` (whether a
  duplicate joins an existing entry), `pantry.ts` (consume/restock/clamp),
  `grouping.ts` and `catalogue.ts` (the list and picker selectors),
  `backup.ts` (building and validating the backup document, including the
  referential repair pass), `navigation.ts` (going back when there may be no
  history), `feedback.ts` (haptics, where haptics exist) and `devScan.ts`
  (barcode injection by URL, development only — see below).
- `extractBarcode` takes `unknown`, not `string`, so the "what if the scanner
  hands us a number" tests stay reachable. Keep it that way.
- `react-test-renderer` is deprecated and doesn't support React 19 — use
  `@testing-library/react-native` for component tests.
- **RNTL v14's API is async.** `render`, `fireEvent` and `fireEvent.press` all
  return promises, because React 19 made `act` async. A missing `await` does not
  fail loudly — it leaves `screen` unset and every query reports "`render`
  function has not been called". Never fire several events with `Promise.all`
  either: overlapping `act` calls corrupt the renderer for the *next* test, not
  the one doing it. And let anything in flight settle before a test ends, or the
  component updates during teardown and breaks whatever runs next.
- `jest.setup.ts` mocks the native modules that cannot run under Jest:
  AsyncStorage (the shipped in-memory mock, so the read-write round trip is
  real), `expo-crypto` (counter ids, so assertions can name an entry),
  `expo-camera` (a view that hands the test a way to say "a barcode was seen"),
  plus haptics, keep-awake and safe-area insets.
- **`jest.isolation.ts` is separate from `jest.setup.ts` for a reason.**
  `setupFiles` runs *before* the test framework exists, so `beforeEach` is not
  defined there; hooks must go in `setupFilesAfterEnv`. It clears AsyncStorage
  and resets the id counter before every test, and `clearMocks`/`restoreMocks`
  in the Jest config handle mock call history and spies.
- **The id counter must reset between tests.** Left running it climbs for the
  life of the file, so `uuid-1` means a different entry depending on how many
  tests ran first — which is exactly the coupling deterministic ids exist to
  remove.
- **`pnpm run test:isolation` shuffles test order** (`jest --randomize`). Run it
  after adding tests that touch storage, the clock or module state: order
  dependence shows up as a failure with a printed seed rather than as a flake
  in CI months later.
- **`testTimeout` is 30s, not Jest's 5s default, and that is not slack for slow
  tests.** React Native's index uses lazy getters, so the *first* `render()` in
  a suite transforms and evaluates a large slice of RN inside the test body. On
  a cold Jest cache — which is every CI run, since `actions/setup-node`'s
  `cache: pnpm` caches the pnpm store and not Jest's transforms — that alone
  exceeds 5s and fails the first test of the heavier suites while every later
  test passes in milliseconds. Reproduce with `pnpm exec jest --clearCache`
  before concluding a test is genuinely slow.
- **A promise a test starts must settle before the test ends.** A lookup mocked
  to stay pending, then resolved on the last line, resolves *after* teardown:
  React warns about an update outside `act`, and the state lands in whichever
  test runs next. Collect every resolver, settle them inside
  `await act(async () => …)`, and assert the result actually arrived.
- **Detox is not an option while the app targets Expo Go.** It needs the native
  `ios/`/`android/` projects, so it requires `expo prebuild`. That would also
  invalidate the SECURITY.md rationale for accepting GHSA-w5hq-g745-h8pq, which
  rests on prebuild never running.
- **Maestro does run against Expo Go** — the earlier note here saying it needed
  a dev build is wrong. Because the app runs inside the Expo Go container you
  cannot `launchApp` with your own bundle id; the flow opens the dev server URL
  instead:

  ```yaml
  - openLink: exp://127.0.0.1:8081
  ```

  It adds no npm packages (the CLI is a separate install, like OpenSpec) and
  needs no prebuild, so the GHSA-w5hq-g745-h8pq rationale survives.
- **Maestro selectors in this app must be `id:`.** Plain-text matching does not
  work here — `maestro hierarchy` returns simulator chrome and nothing else,
  while `testID`s resolve fine. Add a `testID` to an element a flow needs to
  drive; don't decorate the whole tree.
- **Every flow starts with `stopApp`.** `openLink` against an already-running
  Expo Go only foregrounds it, so without this a flow inherits whatever route
  the previous one left. Wait a beat after `stopApp` before `openLink`, and wait
  for the tab bar on a cold start rather than sleeping a guessed interval.
- **Env goes in each flow's header, not in `.maestro/config.yaml`** — a
  single-file run never reads that file.
- **Running Maestro in EAS Workflows would not survive it.** Cloud runs need an
  app binary, which means a build, which means prebuild — the same trap as
  Detox. Local-against-Expo-Go is the only E2E path that keeps SECURITY.md true
  as written.
- Maestro drives **simulators only**; there is no physical-iPhone support, and
  iOS simulators need full Xcode, not just the Command Line Tools.
- **The iOS Simulator has no camera**, so no flow can decode a barcode there.
  Everything *downstream* of the decode is still reachable: in development only,
  a route may carry a `barcode` query parameter that `src/lib/devScan.ts` feeds
  to the same handler the camera calls, so a barcode can be driven all the way
  to a pantry entry. It is gated on `__DEV__` (Metro replaces it with `false`,
  so the branch is dropped from a production build) and the value still goes
  through `extractBarcode` — never let that validation be skipped just because
  the caller is a test. The decode itself remains `expo-camera`'s job and is not
  covered. The Android emulator's virtual scene can be pointed at a supplied
  image, which is the only way to automate the decode without a physical device;
  it is not built. Flows live in `.maestro/`; see its README.

## Code style

- **Biome** does linting, formatting and import sorting — config in
  `biome.json`. `pnpm run lint` to check, `pnpm run lint:fix` to fix.
- **Biome does not typecheck.** It parses TypeScript but has no type
  information, so `const x: number = "nope"` passes `biome check` clean. Type
  errors are caught only by `pnpm run typecheck` (`tsc --noEmit`), which is a
  separate CI gate. Running lint alone proves nothing about types.
- `pnpm run check` is the full local gate: `check:no-js`, then `typecheck`,
  then `lint` — the same three CI runs.
- Chosen over ESLint + Prettier deliberately: it's ~2 packages with no install
  scripts, so pnpm's `strictDepBuilds` gate stays happy. The trade-off is no
  React Native-specific rules, which `eslint-config-expo` would have given.
- Biome's default `indentStyle` is `tab`; this codebase uses 2 spaces. Keep
  `"indentStyle": "space"` in `biome.json` or every file will churn.
- The pre-commit hook reports Biome findings but never rewrites files
  mid-commit.

## Architecture

- `src/state/pantryReducer.ts` — the state machine, pure and directly tested.
  `Action` is a discriminated union and the `default` branch assigns to `never`,
  so adding a variant without handling it fails to compile.
- `src/state/PantryStore.tsx` — the provider around it: the clock, the id
  generator and AsyncStorage, and nothing else. That boundary is what would let
  a sync engine slot in underneath.
- `src/state/scanSession.ts` / `ScanSessionStore.tsx` — the same split for the
  rapid-scan session: pure rules, then a provider that persists on *every* scan
  rather than on an interval. Bootstrapping is the highest-risk moment in this
  app's life; losing forty scans to a crash would be a bad way to fail.
- `src/api/openFoodFacts.ts` — the only place that talks to the network.
- `src/lib/backupFile.ts` — the only place that touches the filesystem or the
  share sheet, and the only `Platform.OS` fork in the feature. `expo-file-system`
  is a warning stub on web, so the web paths are a Blob download and the
  `expo-document-picker` `<input type=file>`; everything above this module deals
  in strings, which is what keeps `backup.ts` testable with no native mocks.
- `src/types.ts` — the shared domain types. `Product` is the *normalized* shape,
  deliberately: see the note under "Dependency policy" about untrusted data.
  Persisted records extend `Tracked` (UUID, `createdAt`/`updatedAt`, `deletedAt`
  tombstone) so multi-device sync stays possible without migrating user data.
- **Two stores over the same products, with opposite retention policies.** The
  `productCache` is a capped offline lookup cache (`capCache`, 300). The
  *catalogue* never evicts — a catalogue that forgets drops your staples out of
  "things you've bought before" precisely because you bought them long ago.
- Calendar dates (expiry) are `YYYY-MM-DD`; instants (`createdAt`, `updatedAt`)
  are UTC epoch milliseconds. `new Date("2026-08-27")` parses as UTC midnight
  and renders a day earlier west of Greenwich — build from local components, and
  count calendar days rather than dividing millisecond differences.
- `app/` is the route map (Expo Router, `typedRoutes` on). `(tabs)` is a route
  *group* — the parentheses keep it out of the URL — and the tab bar is the
  headless `expo-router/ui` one, written here so a count can hang off it.
- **A pushed route wraps its screen in `src/components/SafeScreen.tsx`.** Only
  the tab layout ever handled the safe area, so every route pushed on top of it
  drew its first row under the status bar. It is a route-level concern, not a
  screen-level one: a new route gets the inset by existing, not by someone
  remembering. A full-bleed camera screen passes no edges and insets its own
  overlays instead.
- **`router.back()` is a silent no-op on an empty history stack**, which is the
  normal case for a deep link or a pasted web URL. Use `goBackOr(router, "/…")`
  from `src/lib/navigation.ts`, or the Cancel button is visible, enabled, and
  does nothing.
- Screens are presentational and read/write through the `usePantry()` hook.
  Anything the store hydrates asynchronously must be read as a fallback, not
  frozen into a `useState` initialiser — those run before the first load and
  would silently discard the user's remembered defaults.

## Quick start

```bash
pnpm install --frozen-lockfile
pnpm exec expo start   # then scan the QR with Expo Go
```

The OpenSpec CLI is a separate, global install — it is not restored by
`pnpm install`:

```bash
npm install -g @fission-ai/openspec@1.10.0 --ignore-scripts
```
