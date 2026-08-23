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
  referential repair pass).
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
- `jest.setup.ts` mocks the three native modules that cannot run under Jest:
  AsyncStorage (the shipped in-memory mock, so the read-write round trip is
  real), `expo-crypto` (counter ids, so assertions can name an entry), and
  `expo-camera` (a view that hands the test a way to say "a barcode was seen").
- **Detox is not an option while the app targets Expo Go.** It needs the native
  `ios/`/`android/` projects, so it requires `expo prebuild`. That would also
  invalidate the SECURITY.md rationale for accepting GHSA-w5hq-g745-h8pq, which
  rests on prebuild never running. Expo documents Maestro for E2E; it still
  needs a dev build but adds no npm packages.

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
