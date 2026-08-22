Prerequisite: `migrate-to-expo-router` is merged.

## 1. Types and pure logic (tests first — nothing here needs a device)

- [ ] 1.1 `src/types.ts`: add `Unit`, `PantryEntry`, `CatalogueEntry`,
      `Location`. Remove `GroceryItem`. Keep `Product` and its normalization
      contract exactly as-is.
- [ ] 1.2 `src/lib/quantity.ts` — `parseQuantity(text: unknown)`. Takes `unknown`
      on purpose (see design). Never throws. Falls back to one piece, step one.
- [ ] 1.3 Tests for `quantity.ts`: `500 g`, `1 kg`, `1 L`, `6 x 125 g`, `1,5L`,
      `500 g ℮`, `environ 250 g`, `""`, `null`, `42`, `{}`, emoji, a 10 kB string.
- [ ] 1.4 `src/lib/identity.ts` — normalize a typed name to a stable catalogue
      key. Tests: case, surrounding and inner whitespace, accents, empty.
- [ ] 1.5 `src/lib/merge.ts` — the three-clause merge rule, `LONG_LIFE_DAYS = 30`.
- [ ] 1.6 Tests for `merge.ts`, table-driven: same session; same calendar day but
      different sessions; adjacent days across local midnight; exactly at the
      threshold and one either side; one side dated and the other not; neither
      dated.
- [ ] 1.7 `src/lib/pantry.ts` — `consume`, `restock`, clamping at zero.
- [ ] 1.8 Tests for `pantry.ts`: step larger than remaining amount clamps to 0
      rather than going negative; consuming the last unit marks out of stock;
      restocking a hidden entry.

## 2. Store

- [ ] 2.1 Extract the reducer into `src/state/pantryReducer.ts` — a pure function,
      no React, no AsyncStorage.
- [ ] 2.2 Keep the discriminated-union `Action` and the `never` exhaustiveness
      check in the `default` branch.
- [ ] 2.3 Tests for the reducer directly, with no rendering: add, consume,
      out-of-stock transition, tombstone removal, hydrate from malformed
      persisted data.
- [ ] 2.4 `src/state/PantryStore.tsx` — provider, `usePantry()`, AsyncStorage
      persistence under `@pantry/*` keys. Persistence stays confined here.
- [ ] 2.5 `expo-crypto` for `randomUUID`. Install with `npx expo install`.
- [ ] 2.6 Every mutation sets `updatedAt`. Removal sets `deletedAt` rather than
      dropping the record.
- [ ] 2.7 Delete `src/state/GroceryStore.tsx`.

## 3. Catalogue

- [ ] 3.1 Catalogue store under its own key, unbounded, never evicted.
- [ ] 3.2 Confirm `src/lib/cache.ts` and the capped product cache are untouched —
      they remain a separate concern with the opposite retention policy.
- [ ] 3.3 Write back per-product overrides (unit, both step forms, location) on
      confirm.
- [ ] 3.4 Ordering by use count, with name search.

## 4. Locations

- [ ] 4.1 Locations as records with UUIDs, seeded with Fridge / Freezer /
      Cupboard on first run. Not a union type — see design.
- [ ] 4.2 Add, rename, remove. Removing a location that still has entries needs a
      defined outcome; decide and spec it before implementing.

## 5. Screens

- [ ] 5.1 `app/(tabs)/index.tsx` — pantry list. Grouped by location, alphabetical
      within group, group-by toggle for category.
- [ ] 5.2 Row layout reserves the slot where the expiry date will go (change 6),
      and shows enough to distinguish two rows of the same product.
- [ ] 5.3 Inline `−` / `+` per row.
- [ ] 5.4 Add sheet: count/measure toggle, amount, step, location. Pre-filled
      from the catalogue, or from parsed product data.
- [ ] 5.5 `app/add/scan.tsx` — single-shot scan reusing `extractBarcode` and
      `lookupProduct`, ending at the add sheet.
- [ ] 5.6 `app/add/manual.tsx` — type a name; `app/add/catalogue.tsx` — pick a
      known product.
- [ ] 5.7 `app/entry/[id].tsx` — detail, edit, remove.
- [ ] 5.8 Handle lookup failure and unknown barcodes: entry is still creatable,
      marked as needing a name.
- [ ] 5.9 Delete `src/screens/ListScreen.tsx` and `src/screens/ScanScreen.tsx`.
- [ ] 5.10 Update the tab bar: the unbought-count badge is gone; decide what (if
      anything) replaces it.

## 6. Component tests

- [ ] 6.1 Mock AsyncStorage for store tests.
- [ ] 6.2 Mock `expo-camera` for the scan route — `CameraView` cannot mount in
      Jest. Budget time for this; it is fiddly rather than hard.
- [ ] 6.3 `@testing-library/react-native` (not `react-test-renderer`, which is
      deprecated and does not support React 19) for: pantry list grouping and
      sort order; add sheet count/measure switching; consume to zero hiding a row.

## 7. Verify

- [ ] 7.1 `pnpm run check` clean.
- [ ] 7.2 `pnpm test` green, including every new pure-logic suite.
- [ ] 7.3 Manual on iOS Expo Go: scan → add → appears under the right location →
      consume to zero → disappears → still in the catalogue.
- [ ] 7.4 Manual on web: the same, minus the camera.
- [ ] 7.5 Check what share of real entries fall into the `Other` category bucket.
      If it is large, cut group-by-category rather than shipping it bad — see
      design, Risks.
- [ ] 7.6 Confirm no `@grocery/*` key is read or written anywhere.
