## Context

See proposal.md — Why. The constraints that shape the approach:

- **Three catalogue key forms already exist** in `src/lib/identity.ts`:
  `barcode:<code>` and `name:<normalized>`, chosen with `catalogueKeyFor`. Both
  are prefixed precisely so a typed `12345678` cannot land on a real barcode's
  record. Produce needs a third that cannot collide with either.
- **Every add path converges on `AddProductInput`** (`src/state/pantryReducer.ts`)
  and then on `AddSheet`. There are three builders — `productInputFor`,
  `productInputForUnknownBarcode`, `productInputForName` — and no reducer branch
  per path. A fourth builder is the whole integration surface.
- **`addDefaultsFor`** (`src/lib/catalogue.ts`) already does the right thing for
  a product with no quantity text: `parseQuantity("")` yields one piece, step
  one, and the catalogue record wins wherever it has an opinion. Produce needs
  nothing new here.
- **The catalogue never evicts.** A produce record added once is a record
  forever, which is exactly what makes a canonical key worth having.
- **`grouping.ts` reads `product.category`** and falls back to `OTHER_CATEGORY`.
  Today every hand-typed item lands in `Other`.
- **The FoodKeeper JSON is not machine-retrievable from here.** `fsis.usda.gov`
  returns Akamai *Access Denied* to curl, with and without a browser
  user-agent. Anything automated would be building on a URL that already fails.

## Goals / Non-Goals

**Goals:**

- One tap from the Add hub to a confirmed pantry entry for common produce.
- A produce identity that survives the item being reworded, retranslated, or
  reordered in the data file.
- The vendored table shaped so `add-expiry-estimates` reads it without touching
  the file or the identity scheme.
- Zero new npm dependencies; zero runtime network calls; Expo Go intact.

**Non-Goals:**

- **Completeness.** This is a curated list of what a home cook buys, not a
  botanical index. The escape hatch for everything else is free text, which
  already works.
- **Editing the produce list from inside the app.** It is data, shipped with the
  build. A user who wants a variety we do not carry types the name.
- **Localisation.** English display names only, matching the rest of the app.
- **Images or icons per item.** A 120-row list of thumbnails is a bundle-size
  and sourcing problem for a cosmetic gain. Text rows, like the catalogue picker.
- **Reading `shelfLifeDays`.** Carried, never read. See the spec.

## Decisions

### The identity is `produce:<key>`, and the key is not the name

A third prefix beside `barcode:` and `name:`. The suffix is a slug we assign in
the data file (`carrot`, `bell-pepper`), never the display name and never a
normalization of it.

*Why:* the spec requires identity to survive a rewording. If the key were
`name:carrots`, then renaming the row from `Carrots` to `Carrots, whole` would
silently orphan every entry the user had already added — the catalogue record
would still exist, but nothing would ever resolve to it again, and the item
would look like a brand-new product with a use count of zero. Decoupling the key
from the label costs one field and removes that whole class of failure.

*Alternative considered:* reuse `name:` and treat produce as a pre-filled text
entry. Cheaper by one prefix, and it would make picking `Carrots` and typing
`carrots` the same record, which sounds like a feature. Rejected because it
gives up rename-safety, and because it makes the produce list's curation
retroactively load-bearing on user data: any edit to a display name becomes a
data migration.

*Consequence, accepted:* picking `Carrots` and typing `carrots` yield two
catalogue records, which the spec states outright. This is the honest outcome —
the app cannot know the user meant the same thing, and silently merging them
would be a guess that is unfixable once made. The picker being the easier path
is what keeps this rare.

### The data lives in `src/data/produce.ts`, typed, not in JSON

A TypeScript module exporting a `readonly ProduceItem[]`, not a `.json` file
read at runtime.

*Why:* `tsc` then checks the table. A missing `group`, a typo in a group name, a
duplicate key caught by a test — all become compile-time or test-time failures
rather than a blank row at runtime. It also keeps the offline guarantee
structural rather than a promise: there is no fetch to accidentally add, because
there is no fetchable artifact.

*Why `src/data/` and not `src/lib/`:* `src/lib/` is documented in AGENTS.md as
pure *logic*, tested without a native build. A 120-row table is data, and mixing
it in would blur a boundary the project has kept clean. `src/lib/produce.ts`
holds the logic over it.

*Alternative considered:* generate the table from the raw FoodKeeper JSON with a
committed script. Rejected for this change: the source is not fetchable
automatically, so the script's input would itself have to be committed, and we
would be maintaining a generator, its input, and its output to produce a file a
human curates by hand anyway. The retrieval date in the header is the honest
version of what a generator would give us.

### Curation is a human pass, recorded as a task

FoodKeeper's produce entries are shelf-life rows, not a shopping vocabulary:
they split by storage state and preparation in ways that make no sense in a
picker. The subset is chosen by hand, aiming at ~100–150 rows.

*Why not ship it verbatim:* the picker would show near-duplicates that differ
only by a storage qualifier, and the user would have to understand FoodKeeper's
taxonomy to pick correctly. That is the opposite of one-tap.

### Search reuses `normalizeName`, and the picker owns grouping

`src/lib/produce.ts` exposes grouping and search over the table, mirroring
`searchCatalogue`'s shape and calling the same `normalizeName` from
`identity.ts`.

*Why:* the spec requires `jalapeno` to find `Jalapeño`, which is the exact
behavior `normalizeName` exists for. Two different notions of "the same string"
in one app is a bug generator; there is already one, and this uses it.

### The group is the category

`ProduceItem.group` supplies `AddProductInput.category` directly, so no mapping
table sits between them.

*Why:* the pantry's category view and the picker's sections are answering the
same question — what kind of thing is this — and two vocabularies would drift.
The groups are chosen to read correctly as pantry section headings.

### The Add hub gains an option and loses a claim

A new "Fruit & veg" option, and "Type a name" drops "For loose fruit and veg"
from its subtitle.

*Why the copy change is not cosmetic:* leaving it would put two options on one
screen both claiming the same job, with the worse one listed as the route for
it. The hub is the only place the user chooses between paths, so it is the only
place this can be gotten wrong.

## Risks / Trade-offs

- **A curated list is a judgement call, and someone's staple will be missing.**
  → Free text stays, and the picker's empty-search state offers it directly with
  what was typed carried over. A miss costs the user the flow they have today,
  not worse.

- **Two records for the same vegetable** when a user types what they could have
  picked. → Accepted and specced, not hidden. Mitigated by making the picker the
  easier path, and by the hub no longer advertising free text for produce. A
  merge-existing-records feature is a real answer later, but guessing now is
  worse than the duplicate.

- **The table ages.** FoodKeeper updates; our subset does not. → It is a shelf
  life reference, not a price list — the data moves on a scale of years. The
  retrieval date in the header is what makes a refresh possible; without it,
  nobody would know whether one was due.

- **Bundle size.** ~120 rows of short strings is on the order of 10 KB before
  minification, shipped in the JS bundle. → Negligible against the existing
  bundle, and it buys the offline guarantee outright.

- **`shelfLifeDays` sits unused, and unused fields rot.** → It is populated
  during curation, when the source is open in front of whoever is doing it;
  populating it later means a second pass over the same rows. A test asserts it
  is present so it cannot quietly become half-filled, and the spec forbids
  reading it, so it cannot half-work either.

## Migration Plan

No migration. Nothing existing changes shape: no persisted record gains or loses
a field, `AddProductInput` keeps its type, and the reducer's action union is
untouched. Entries added by hand before this change keep their `name:` keys and
go on resolving.

Rollback is deleting the route, the screen, the data file and the hub option.
Catalogue records created under `produce:` keys would be left behind pointing at
nothing renderable by the picker — but they are ordinary catalogue records with
a name and a category, so the pantry, the catalogue picker and search all keep
working on them. Nothing is orphaned in a way the user can see.

## Open Questions

- **Whether "Herbs & aromatics" earns its own group** or folds into Vegetables.
  It depends on how many rows survive curation — a group of four is noise. The
  data file is the only thing affected, and the picker renders whatever groups
  exist, so this can be settled while curating without touching the spec, the
  approach, or the tasks.
