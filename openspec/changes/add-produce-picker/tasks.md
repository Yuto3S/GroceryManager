## 1. The vendored data

- [ ] 1.1 **Human step, not automatable.** Retrieve the FoodKeeper dataset by
      hand — `https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`, or the
      XLS beside it on `catalog.data.gov/dataset/fsis-foodkeeper-data` — and put
      the raw copy in the scratchpad, *not* in the repo. The URL returns Akamai
      *Access Denied* to curl and to a browser user-agent, so a download from a
      script or from CI is not an option; verify by opening it in a browser and
      confirming you have the JSON or the spreadsheet in hand.
- [ ] 1.2 Define `ProduceItem` (`key`, `name`, `group`, `shelfLifeDays`) and the
      `ProduceGroup` union in `src/data/produce.ts`, and verify `pnpm run
      typecheck` passes with an empty table
- [ ] 1.3 Curate the produce rows from the raw data down to roughly 100–150
      items a home cook buys — collapsing FoodKeeper's storage-state and
      preparation splits into one row per thing — with `key` a hand-assigned
      slug that is never derived from `name`, and verify the file typechecks
- [ ] 1.4 Settle design.md's open question while curating: keep
      `Herbs & aromatics` as its own group only if enough rows survive to make a
      section worth having, otherwise fold them into `Vegetables`, and record
      which way it went in the file header
- [ ] 1.5 Write the file header stating the upstream source, its CC0 licence,
      and the retrieval date, and verify it satisfies the spec's provenance
      scenario by reading it back
- [ ] 1.6 Verify with a test that every `key` in the table is unique, that no
      `key` is empty, and that every item has a non-empty `name` and a valid
      `group`
- [ ] 1.7 Verify with a test that every item carries a non-null `shelfLifeDays`
      — the field must not become half-filled between now and
      `add-expiry-estimates`

## 2. Identity

- [ ] 2.1 Add `catalogueKeyForProduce(key)` to `src/lib/identity.ts` returning
      `produce:<key>`, and verify with a test that it cannot collide with a
      `barcode:` or `name:` key for the same text
- [ ] 2.2 Verify with a test that the produce key is independent of the display
      name — changing an item's `name` in a fixture leaves the key unchanged,
      which is the rename-safety the design rests on

## 3. Selecting from the list

- [ ] 3.1 Implement `groupProduce()` in `src/lib/produce.ts` returning the
      groups in fixed order with items ordered predictably inside each, and
      verify with a test that two calls produce identical output
- [ ] 3.2 Implement `searchProduce(query)` over the same `normalizeName` the
      catalogue uses, and verify with tests that `jalapeno` finds `Jalapeño`,
      that a punctuation-only query returns everything, and that a query
      matching nothing returns an empty result rather than everything
- [ ] 3.3 Verify with a test that a group with no matching items is absent from
      the search result, not present and empty

## 4. Into the add sheet

- [ ] 4.1 Add `productInputForProduce(item)` to `src/state/pantryReducer.ts`
      building an `AddProductInput` with the produce key, the item's name, its
      group as `category`, empty `brand`/`quantityText`, null `imageUrl` and
      `nutriScore`, `needsName: false`, and `shelfLifeDays: null`; verify with a
      test that the shelf life from the data does **not** reach the payload
- [ ] 4.2 Verify with a test through the reducer that adding the same produce
      item twice produces one catalogue record with a use count of two, and that
      picking `Carrots` and typing `carrots` produce two distinct records
- [ ] 4.3 Verify with a test that `addDefaultsFor` gives a first-time produce
      item one piece with a step of one, and that a second add picks up the
      unit, step and location the user chose the first time

## 5. The screen and the route

- [ ] 5.1 Add `src/screens/ProduceAddScreen.tsx` — grouped sections, a search
      box, rows that hand the item to `AddSheet` — following
      `CatalogueAddScreen`'s shape, and verify it renders the groups under RNTL
- [ ] 5.2 Give the empty-search state a way out to free text that carries the
      typed query across to the manual screen, and verify with a component test
      that the query survives the handoff
- [ ] 5.3 Add `app/add/produce.tsx` wrapping the screen in `SafeScreen`, with
      `onCancel` going through `goBackOr(router, "/add")`, and verify the route
      typechecks under `experiments.typedRoutes`
- [ ] 5.4 Add the "Fruit & veg" option to `src/screens/AddHubScreen.tsx` with a
      `testID`, and remove "For loose fruit and veg" from the "Type a name"
      subtitle so two options no longer claim the same job; verify with a
      component test that both options are present and route correctly
- [ ] 5.5 Verify with a component test that adding produce and viewing the
      pantry grouped by category places the entry under its produce category and
      not under `Other`
- [ ] 5.6 Verify with a component test that the add sheet shows no brand, image
      or Nutri-Score for a produce item, and that its expiry field is empty

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
