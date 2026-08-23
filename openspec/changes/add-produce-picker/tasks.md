## 1. The vendored data

- [x] 1.1 **Human step, not automatable.** Retrieve the FoodKeeper dataset by
      hand — `https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`, or the
      XLS beside it on `catalog.data.gov/dataset/fsis-foodkeeper-data` — and put
      the raw copy in the scratchpad, *not* in the repo. The URL returns Akamai
      *Access Denied* to curl and to a browser user-agent, so a download from a
      script or from CI is not an option; verify by opening it in a browser and
      confirming you have the JSON or the spreadsheet in hand.
- [x] 1.2 Define `ProduceItem` (`key`, `name`, `group`, `shelfLifeDays`) and the
      `ProduceGroup` union in `src/data/produce.ts`, and verify `pnpm run
      typecheck` passes with an empty table
- [x] 1.3 Curate the produce rows from the raw data down to roughly 100–150
      items a home cook buys — collapsing FoodKeeper's storage-state and
      preparation splits into one row per thing — with `key` a hand-assigned
      slug that is never derived from `name`, and verify the file typechecks
- [x] 1.4 Settle design.md's open question while curating: keep
      `Herbs & aromatics` as its own group only if enough rows survive to make a
      section worth having, otherwise fold them into `Vegetables`, and record
      which way it went in the file header
- [x] 1.5 Write the file header stating the upstream source, its CC0 licence,
      and the retrieval date, and verify it satisfies the spec's provenance
      scenario by reading it back
- [x] 1.6 Verify with a test that every `key` in the table is unique, that no
      `key` is empty, and that every item has a non-empty `name` and a valid
      `group`
- [x] 1.7 Verify with a test that every item carries a non-null `shelfLifeDays`
      — the field must not become half-filled between now and
      `add-expiry-estimates`

## 2. Identity

- [x] 2.1 Add `catalogueKeyForProduce(key)` to `src/lib/identity.ts` returning
      `produce:<key>`, and verify with a test that it cannot collide with a
      `barcode:` or `name:` key for the same text
- [x] 2.2 Verify with a test that the produce key is independent of the display
      name — changing an item's `name` in a fixture leaves the key unchanged,
      which is the rename-safety the design rests on

## 3. Selecting from the list

- [x] 3.1 Implement `groupProduce()` in `src/lib/produce.ts` returning the
      groups in fixed order with items ordered predictably inside each, and
      verify with a test that two calls produce identical output
- [x] 3.2 Implement `searchProduce(query)` over the same `normalizeName` the
      catalogue uses, and verify with tests that `jalapeno` finds `Jalapeño`,
      that a punctuation-only query returns everything, and that a query
      matching nothing returns an empty result rather than everything
- [x] 3.3 Verify with a test that a group with no matching items is absent from
      the search result, not present and empty

## 4. Into the add sheet

- [x] 4.1 Add `productInputForProduce(item)` to `src/state/pantryReducer.ts`
      building an `AddProductInput` with the produce key, the item's name, its
      group as `category`, empty `brand`/`quantityText`, null `imageUrl` and
      `nutriScore`, `needsName: false`, and `shelfLifeDays: null`; verify with a
      test that the shelf life from the data does **not** reach the payload
- [x] 4.2 Verify with a test through the reducer that adding the same produce
      item twice produces one catalogue record with a use count of two, and that
      picking `Carrots` and typing `carrots` produce two distinct records
- [x] 4.3 Verify with a test that `addDefaultsFor` gives a first-time produce
      item one piece with a step of one, and that a second add picks up the
      unit, step and location the user chose the first time

## 5. The screen and the route

- [x] 5.1 Add `src/screens/ProduceAddScreen.tsx` — grouped sections, a search
      box, rows that hand the item to `AddSheet` — following
      `CatalogueAddScreen`'s shape, and verify it renders the groups under RNTL
- [x] 5.2 Give the empty-search state a way out to free text that carries the
      typed query across to the manual screen, and verify with a component test
      that the query survives the handoff
- [x] 5.3 Add `app/add/produce.tsx` wrapping the screen in `SafeScreen`, with
      `onCancel` going through `goBackOr(router, "/add")`, and verify the route
      typechecks under `experiments.typedRoutes`
- [x] 5.4 Add the "Fruit & veg" option to `src/screens/AddHubScreen.tsx` with a
      `testID`, and remove "For loose fruit and veg" from the "Type a name"
      subtitle so two options no longer claim the same job; verify with a
      component test that both options are present and route correctly
- [x] 5.5 Verify with a component test that adding produce and viewing the
      pantry grouped by category places the entry under its produce category and
      not under `Other`
- [x] 5.6 Verify with a component test that the add sheet shows no brand, image
      or Nutri-Score for a produce item, and that its expiry field is empty

## 5b. Layout redesign (added after review)

- [x] 5b.1 Rebuild the picker as a three-column grid, and verify with tests that
      a short final row is left short rather than padded — `flex: 1` tiles would
      stretch a last row of one across the screen
- [x] 5b.2 Add `gridRows()` to `src/lib/produce.ts` and verify it keeps every
      item in order, handles an empty list, and refuses a zero column count
      rather than looping forever
- [x] 5b.3 Add a chip row (All / Veg / Fruit / Herbs) pinned above the scroll
      area, and verify with tests that a chip narrows to one group and that
      tapping it again returns to everything
- [x] 5b.4 Make sections collapsible, keeping the header and count when shut,
      and verify with tests that a collapse hides the tiles, that expanding
      restores them, and that a search still shows results inside a collapsed
      section
- [x] 5b.5 Put every produce icon behind `src/components/ProduceIcon.tsx` so the
      unresolved artwork question cannot spread into the layout; verify the
      screen renders an item's own icon and never a lookalike
- [x] 5b.6 Show the produce icon on the add sheet instead of the empty
      placeholder box, via `produceForCatalogueKey`, and verify with a test that
      a picked item's icon appears and the placeholder glyph does not
- [x] 5b.7 Fix cancelling the add sheet so it returns to the selection step
      rather than leaving the screen, in the produce, catalogue and manual
      screens alike; verify with tests that the sheet's Cancel returns to the
      grid and the screen's own Cancel still exits
- [ ] 5b.8 **Blocked on the user:** settle what a produce icon is made of. See
      design.md's open question — `open-crop-icons` (CC0) covers 77 of 103 and
      no free set covers the fruit. Only `ProduceIcon.tsx` changes.

## 6. End to end

- [ ] 6.1 Add `.maestro/add-produce.yaml` driving hub → picker → search → tap →
      add sheet → confirm → the entry visible in the pantry, using `id:`
      selectors only, `stopApp` first, env in the flow header, per
      `.maestro/README.md`; verify it passes against the iOS simulator
- [ ] 6.2 Add the new flow to the table in `.maestro/README.md` and verify the
      whole directory still passes with `maestro test .maestro/`

## 7. Gates and documentation

- [ ] 7.1 Run `pnpm test` and `pnpm run check` and verify both pass clean
- [ ] 7.2 Update `AGENTS.md`: `src/data/` as a new directory and what belongs
      there versus `src/lib/`, `produce.ts` in the lib list, and the third
      catalogue key form
- [ ] 7.3 Update `README.md`'s "What it does today" and project layout to
      include the produce path
- [ ] 7.4 Add a line to `SECURITY.md` recording that the produce table is
      vendored, human-retrieved, and never fetched at runtime, install time or
      CI time — the offline guarantee depends on it staying that way
