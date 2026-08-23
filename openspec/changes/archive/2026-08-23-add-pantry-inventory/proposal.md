## Why

The app today is a **shopping list**: a queue of things to buy, drained by
checking them off. What is actually wanted is a **pantry**: a record of what is
in the fridge, freezer and cupboards right now, decremented as things get
cooked. Those are different domains that happen to share a barcode scanner.

The shopping list is not a stepping stone toward the pantry — its central
concept (`bought`) has no meaning in an inventory. Extending it would leave a
data model shaped by the wrong question. Replacing it outright is both simpler
and honest about what changed.

Re-buy suggestions, the feature the shopping list gestures at, return later
(see Roadmap) built on real consumption data rather than a checkbox.

## What Changes

- **BREAKING**: the grocery list is removed. `GroceryItem`, `bought`,
  `toggleBought`, `clearBought` and `ListScreen` all go. Existing persisted data
  under `@grocery/*` is abandoned rather than migrated — it records answers to a
  question the app no longer asks.
- New **pantry entry** model: a product, an amount, a unit, a consume step, and a
  location.
- New **product catalogue**: everything ever added, never evicted, carrying
  per-product knowledge (default unit, step) that improves each time it is used.
  Distinct from the existing offline lookup cache, which stays capped.
- New **locations** (fridge / freezer / cupboard, user-extensible) as the pantry's
  default grouping.
- New **add sheet** shared by every input path, with a count-vs-weight choice.
- New **pantry screen**: grouped by location, alphabetical within a group,
  switchable to grouping by category.
- Entries that reach zero become **hidden, not deleted** — they are the purchase
  history that later features read.
- Identity and audit fields sized for eventual multi-device sync: UUIDs,
  `updatedAt`, tombstones.

## Capabilities

### New Capabilities

- `pantry`: what the user owns — entries, amounts, units, consume steps,
  locations, the hidden-at-zero rule, and the merge rule for duplicates.
- `product-catalogue`: the durable record of every product ever added, and the
  per-product defaults that accumulate on it.
- `pantry-entry-creation`: the shared add flow — scanning a barcode, picking from
  the catalogue, or typing a name — and the sheet that resolves amount, unit and
  location before an entry exists.

### Modified Capabilities

None. There is no existing spec for the grocery list — this repo has no specs
yet — so its removal is captured in **What Changes** rather than as a delta
against a spec that was never written.

## Impact

**Removed**: `src/screens/ListScreen.tsx`, `GroceryItem`, the `bought` /
`boughtAt` fields, `TOGGLE_BOUGHT` / `CLEAR_BOUGHT` / `ADD_ITEM` actions, the
`@grocery/list/v1` storage key.

**Added**: `src/types.ts` gains `PantryEntry`, `CatalogueEntry`, `Location`,
`Unit`. New `src/lib/` modules for quantity parsing and the merge rule. New
routes under `app/`.

**Unchanged**: `src/api/openFoodFacts.ts` and its normalization rules;
`src/lib/barcode.ts`; the capped product cache in `src/lib/cache.ts`.

**Dependencies**: `expo-crypto` for `randomUUID` (bundled in Expo Go). No others.

**Prerequisite**: `migrate-to-expo-router`. This change assumes an `app/` route
tree exists.

## Roadmap

Recorded so the reasoning behind this change's scope is not lost. Each becomes
its own change; none is specified here.

| | Change | Why it is not in this one |
|---|---|---|
| 3 | `add-rapid-scan-mode` | Continuous-scan bootstrapping. Needs the entry model to exist first, and is a big enough flow to review on its own. |
| 4 | `add-pantry-export` | JSON backup/restore. Small, independent, and only urgent once there is hand-entered data worth losing. |
| 5 | `add-cooking-mode` | Batch consume with single-transaction undo, plus the consumption event log. The interaction that keeps the data true. |
| 6 | `add-expiry-estimates` | Shelf-life estimates from a vendored USDA FoodKeeper table (CC0), plus the produce picker for items without barcodes. |
| 7 | `add-rebuy-suggestions` | The shopping list returns, fed by out-of-stock entries and consumption history, opt-in per product. |

**Cross-device sync is deliberately not on this list.** It is a standing design
constraint — the reason this change adopts UUIDs, `updatedAt` and tombstones —
not planned work. Those three decisions are cheap now and expensive to retrofit;
everything else about sync waits until it is actually wanted.
