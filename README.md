# Grocery Scanner 🛒

A **home pantry inventory** for React Native (Expo): scan a product barcode →
look it up on [Open Food Facts](https://world.openfoodfacts.org) → record how
much of it you have and where you keep it → tap it down as you cook.

It started as a shopping list. That's gone: `bought` has no meaning in an
inventory. Re-buy suggestions come back later, built on real consumption data
rather than a checkbox.

Built as a starting point — the code is clean and commented so you can keep
building it with Claude Code.

## What it does today

**Two tabs.**

- **Pantry** — everything you have, grouped by **location** (Fridge, Freezer,
  Pantry, …) or by **category**, with the count of what's in stock on the tab.
  Tap an entry to consume or restock it; an entry that hits zero disappears
  from the list but stays persisted, because that history is what re-buy
  suggestions will be built on.
- **Add** — the hub for the four ways in:
  - **Scan** a barcode with the camera (EAN/UPC, plus GS1 Digital Link QR).
  - **Rapid scan** — bootstrapping mode: scan a whole shelf without stopping,
    then review the batch in one pass. The session is written to the device on
    every scan, so killing the app mid-shelf loses nothing, and it survives
    aeroplane mode: lookups that fail are retried at review.
  - **From the catalogue** — anything you've added before, ranked by how often
    you actually use it.
  - **By hand** — type a name. No camera, no network, works everywhere.

**Everything else worth knowing.**

- **Locations** are yours to edit (`/locations`). Each catalogue product
  remembers the location, unit and step size you last used for it, so the
  second tin of tomatoes is one tap.
- **Expiry dates** are optional per entry, stored as calendar dates and counted
  in calendar days — not millisecond arithmetic, which drifts a day west of
  Greenwich.
- **Backup and restore** (`/backup`) — export the whole pantry as a JSON file
  to the share sheet (or a browser download), and import it back. See
  [Backups](#backups) below.
- **Offline-friendly** — the pantry and every product you've scanned before are
  on the device. The *only* thing needing internet is looking up a barcode
  you've never scanned.
- **Web works too**, minus the camera on most browsers — scanning is offered
  only where the browser has a real native `BarcodeDetector` (see
  [SECURITY.md](SECURITY.md) for why the WASM fallback is refused).

## Running it (the fast way, on your own phone)

You don't need Xcode or Android Studio to try it.

1. Install **Node.js 22.13+** if you don't have it. React Native 0.86 would
   accept `^20.19.4` too, but the pinned `pnpm@11.22.0` requires `>=22.13`, so
   22.13 is the real floor for this project. CI runs exactly that version.
2. In this folder, install dependencies with **pnpm** — this project pins
   `pnpm@11.22.0` and the lockfile is authoritative:
   ```bash
   pnpm install --frozen-lockfile
   ```
3. Start the dev server:
   ```bash
   pnpm exec expo start
   ```
4. On your phone, install **Expo Go** (App Store / Play Store), open it, and
   scan the QR code shown in your terminal. The app loads live on your phone —
   fittingly, by scanning a QR code. 😄

> Tip: if any package version looks mismatched, run `npx expo install --check`
> to see what Expo expects, then `npx expo install --fix` to apply it.

The app stays runnable in **Expo Go** on purpose: no custom native modules, no
`expo prebuild`. That constraint is load-bearing — it is what keeps one of the
accepted `pnpm audit` findings unreachable, and it decides which E2E tools are
available. Don't break it casually.

## Project layout

```
app/                       Expo Router routes — the URL map
  _layout.tsx              Root stack + state providers
  (tabs)/_layout.tsx       Headless tab bar (Pantry / Add) with the in-stock count
  (tabs)/index.tsx         Pantry             /
  (tabs)/add.tsx           Add hub            /add
  add/scan.tsx             Single scan        /add/scan
  add/rapid.tsx            Rapid scan         /add/rapid
  add/review.tsx           Review a session   /add/review
  add/catalogue.tsx        Pick a known item  /add/catalogue
  add/manual.tsx           Type a name        /add/manual
  entry/[id].tsx           One pantry entry   /entry/:id
  locations.tsx            Edit locations     /locations
  backup.tsx               Export / import    /backup
src/
  api/openFoodFacts.ts     The only place that talks to the network
  state/pantryReducer.ts   The state machine — pure, no React, no clock, no storage
  state/PantryStore.tsx    The provider: clock, id generator, AsyncStorage
  state/scanSession.ts     Rapid-scan session rules (pure)
  state/ScanSessionStore.tsx  …and its provider, persisted on every scan
  screens/                 Presentational screens, one per route
  components/SafeScreen.tsx   Safe-area chrome every pushed route wraps itself in
  lib/                     Pure logic, unit-tested without a native build
  types.ts                 Shared domain types (Product, PantryEntry, …)
  theme.ts                 Colours / Nutri-Score palette
.maestro/                  End-to-end flows — see .maestro/README.md
openspec/                  Specs and change proposals
```

`src/lib/` is where anything testable lives, deliberately:

| Module | What it decides |
|---|---|
| `barcode.ts` | What we're willing to send to Open Food Facts |
| `cache.ts` | Bounding the offline product cache |
| `quantity.ts` | Parsing untrusted quantity text ("500 g", "1,5 L") |
| `identity.ts` | Stable catalogue keys |
| `merge.ts` | Whether a duplicate joins an existing entry |
| `pantry.ts` | Consume / restock / clamp |
| `grouping.ts` | The pantry list's sections and ordering |
| `catalogue.ts` | The picker's ranking |
| `backup.ts` | Building and validating a backup, incl. referential repair |
| `backupFile.ts` | The only filesystem / share-sheet code, and the only `Platform.OS` fork |
| `scanning.ts` | Whether this platform can really scan |
| `navigation.ts` | Going back when there may be no history to go back to |
| `feedback.ts` | Haptics on a scan, where haptics exist |
| `devScan.ts` | Injecting a barcode by URL — **development only** |

## Checks

The project is **TypeScript throughout**, in `strict` mode plus
`noUncheckedIndexedAccess`. Three checks run in CI and you can run all of them
at once with `pnpm run check`:

| Command | What it catches |
|---|---|
| `pnpm run typecheck` | Type errors (`tsc --noEmit`) |
| `pnpm run lint` | Style, formatting, import order (Biome) |
| `pnpm run check:no-js` | A `.js` file sneaking back in |

Biome and `tsc` do genuinely different jobs — Biome has no type information, so
it will happily accept `const x: number = "nope"`. You need both.

`pnpm test` runs the unit tests (Jest via `jest-expo`). They cover the reducer
and everything in `src/lib/`, plus component tests through
`@testing-library/react-native`.

## End-to-end tests

Unit tests assert on the element tree. They cannot see whether an element is
*reachable* — on screen, not behind the tab bar, with a way back out. Every bug
found by hand in this project so far has lived in that gap.

[`.maestro/`](.maestro/README.md) closes it: five flows driven by
[Maestro](https://maestro.dev) against Expo Go in a simulator. Maestro is a
separate install (like the OpenSpec CLI), adds no npm packages and needs no
prebuild.

```bash
brew install mobile-dev-inc/tap/maestro
pnpm exec expo start          # leave running
maestro test .maestro/
```

The iOS Simulator has no camera, so nothing there can decode a real barcode.
The scan path is still driven end to end by injecting a barcode through the URL
in development — `?barcode=3017620422003`, gated on `__DEV__` so a shipped build
cannot be made to fabricate a scan. Read `.maestro/README.md` for what that does
and does not prove.

## Backups

`/backup` writes the whole pantry — entries, catalogue, locations, tombstones —
as one JSON document. On device it goes to the share sheet; on web it's a
download. Importing replaces what's there.

**A backup file is untrusted input**, on exactly the same terms as Open Food
Facts data: it can be hand-edited, truncated by a transfer, or be some other
JSON file entirely. `parseBackup` checks it field by field. A structural failure
rejects the whole document; a single malformed record is dropped and *reported*,
because throwing away a hundred-item backup over one bad entry would cost you
your pantry.

## Where the product data comes from

Open Food Facts is a free, open, community-run database with strong coverage of
German groceries (Rewe, Edeka, Aldi, Lidl, etc.). No API key needed. Endpoint
used:

```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

If a barcode isn't found, the app tells you and you can still add the item by
hand. If you want to contribute missing products, Open Food Facts lets anyone
add them via their app.

Because anyone can edit it, every field is normalized in
`src/api/openFoodFacts.ts` before it reaches the app, and image URLs that aren't
plain `https://` are dropped. The response stays typed `unknown` until it has
been checked — annotating it as a `Product` would be an assertion, not a check.

## Building on it with Claude Code

Changes here run through **OpenSpec**, a spec-driven workflow: you describe the
idea, Claude writes a proposal (`proposal.md`, `design.md`, `tasks.md` and a
spec delta) under `openspec/`, and only then implements it. The point is to
agree on *what* gets built before any code appears.

```bash
npm install -g @fission-ai/openspec@1.10.0 --ignore-scripts   # one-time, global
```

Then, in Claude Code: `/opsx:propose "quantities per item"` → `/opsx:apply` →
`/opsx:archive`. Use `/opsx:explore` first if the idea is still fuzzy. The
skills and slash commands are generated into `.claude/` and are committed, so
they work as soon as you clone — only the CLI itself needs installing.

`AGENTS.md` holds the ground rules an agent should read before changing
anything; `SECURITY.md` holds the threat model and the dependency policy.

## Ideas for next versions (good tasks for Claude Code)

- **Re-buy suggestions** built on consumption history — the feature the
  shopping list was replaced to make possible.
- A barcode-scanning E2E flow on the Android emulator, whose virtual camera can
  be pointed at a supplied image. It's the only way to automate the decode
  itself without a physical device.
- Expiry notifications, so the yoghurt at the back gets used.
- Sync across devices. The records already carry UUIDs, `updatedAt` and
  tombstones for exactly this, and `PantryStore.tsx` is the seam a sync engine
  would slot under.
- Richer nutrition detail (ingredients, allergens, additives) from the API.
- A history view of what you've consumed, with dates.
