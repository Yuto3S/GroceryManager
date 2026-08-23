## Why

Loose fruit and veg is the largest category of thing this app cannot scan, and
right now it is also the worst thing to enter: the only route is "Type a name",
a blank text box. Every apple costs the user a spelling decision — `Apple`,
`apples`, `Braeburn apple` — and `catalogueKeyForName` will happily key three
catalogue records for what the user thinks of as one product. The picker turns
the most common barcode-less add into a tap, and makes the catalogue key
deterministic while doing it.

It is also the prerequisite for shelf-life estimates. Expiry prefill is only
useful if the app knows *what* the thing is, and a typed string never will.
Getting a canonical produce identity in place first is what makes
`add-expiry-estimates` a small change rather than a large one.

## What Changes

- **A browsable fruit & veg picker**, reached from the Add hub, listing roughly
  100–150 items grouped as Vegetables / Fruit / Herbs & aromatics. Search
  narrows it; tapping an item goes straight to the existing add sheet.
- **A vendored produce table** at `src/data/produce.ts` — a curated subset of
  the USDA FoodKeeper dataset (CC0), hand-trimmed to what a home cook actually
  buys. It is a source file, not a package: no new npm dependency, no network
  call, no build step.
- **Produce gets a canonical catalogue key.** A picked item carries a stable
  `produce:<key>` identity rather than being keyed off however the user spelled
  it, so "Apples" is one catalogue record forever.
- **Produce carries a category**, so the pantry's group-by-category view puts it
  under Vegetables/Fruit instead of the `Other` bucket where every hand-typed
  item lands today.
- **"Type a name" stays**, unchanged, for everything that is not produce — a
  loaf from the bakery, a jar with a peeled label. The picker is an additional
  path, not a replacement for free text.
- **The Add hub's copy changes**: "Type a name" no longer claims to be the route
  for "loose fruit and veg", because it no longer is.
- **`shelfLifeDays` is carried in the vendored data but read by nothing.** It is
  populated so `add-expiry-estimates` needs no re-vendoring, and this change
  must not act on it. `AddProductInput.shelfLifeDays` stays `null` throughout.

**Not in this change** — deliberately, and specced separately as
`add-expiry-estimates`: shelf-life estimates, expiry prefill on add, and
activating the currently inert `LONG_LIFE_DAYS` clause in `src/lib/merge.ts`.

## Capabilities

### New Capabilities
- `produce-picker`: browsing, searching and selecting an item from a fixed
  catalogue of fruit, vegetables and herbs that carry no barcode, and the
  identity and provenance rules for the vendored table behind it.

### Modified Capabilities
- `pantry-entry-creation`: the picker becomes a fourth way into the add sheet,
  so the existing "Every add path ends at the same sheet" requirement has to
  name it, and a produce selection has to state what it contributes to the
  product that reaches the sheet.

## Impact

**New**
- `src/data/produce.ts` — the vendored table. Manually retrieved; see below.
- `src/lib/produce.ts` — grouping and search over it, pure and unit-tested.
- `src/screens/ProduceAddScreen.tsx` and `app/add/produce.tsx`.
- `.maestro/add-produce.yaml` — drivable on the iOS simulator, no camera needed.

**Modified**
- `src/screens/AddHubScreen.tsx` — a new option; corrected copy on "Type a name".
- `src/state/pantryReducer.ts` — a `productInputForProduce` builder alongside
  the three that exist. No new action type, no reducer branch.
- `src/lib/identity.ts` — a `produce:` key form beside `barcode:` and `name:`.

**Unchanged, deliberately**: the reducer's action union, `AddSheet`, the merge
rule, the catalogue's eviction policy (there is none), and every existing add
path.

**Dependencies**: none added. The app stays Expo Go compatible; nothing here is
native.

**Data provenance is a manual step.** The official FoodKeeper JSON at
`fsis.usda.gov/shared/data/EN/foodkeeper.json` returns *Access Denied* to
automated fetches (Akamai edge, both plain and with a browser user-agent), so a
human retrieves it once and the curated subset is committed. No install-time or
CI-time download may be introduced — that would break the offline guarantee and
put a third-party host in the build path, which SECURITY.md does not allow. The
data is CC0, so attribution is not legally required; the file header records the
source and retrieval date anyway, because a table nobody can date is a table
nobody can refresh.
