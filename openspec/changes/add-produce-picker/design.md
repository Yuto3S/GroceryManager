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
- **~~Images or icons per item.~~ Reversed after review.** This was ruled out as
  a cosmetic gain not worth the bundle and sourcing cost. That was wrong about
  what the icon is *for*: with a hundred items the picture is what you find the
  row by, and without it the picker is a wall of text that is not obviously
  faster than typing. Icons are now in scope; what they are made of is the one
  open question below.
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

## Layout decisions (added after first review)

The first build was a flat list of 103 rows with a search box. It worked and it
was unusable: a column of near-identical text rows you read one at a time. Four
changes, agreed with the user:

- **A grid, not a list.** Three tiles per row. This is what makes an icon worth
  having — in a list row a picture is decoration beside the name you actually
  read, in a grid it is the thing you find the item by. Three columns rather
  than four because "Brussels sprouts" and "Spaghetti squash" need two lines at
  four on a narrow phone, and a grid with uneven tile heights stops reading as
  a grid.
- **Tiles are a fixed share of the row (`width: 31.5%`), not `flex: 1`.** With
  `flex: 1` a final row of one stretches that tile across the screen, which
  reads as a different kind of thing rather than as the end of the list. The
  fixed width is also what lets `gridRows` leave a short row short instead of
  padding it with nulls the renderer has to skip.
- **A chip row (All / Veg / Fruit / Herbs) and collapsible sections.** Both
  pinned above the scroll area, because filtering a long grid is exactly what
  you want after scrolling into it, and that is exactly when a control inside
  the scroll view is off screen. A collapsed section keeps its header *and its
  count*, so it reads as shut rather than gone. Searching overrides a collapse:
  hiding results the user just asked for would read as the search being broken.
- **Icons go through `src/components/ProduceIcon.tsx` and nowhere else**, so the
  unresolved artwork question below cannot spread into the layout.

**Cancelling the add sheet returns to the picker, not out of it.** All three
pick-then-confirm screens passed the route's `onCancel` straight into
`AddSheet`, so backing out of one item threw away the search, the open section
and the typed name that got you there. Fixed in the produce, catalogue and
manual screens together — same defect, same fix, and leaving two of three broken
would be worse than either state.

**The add sheet shows the produce icon.** It has three cases now, in order of
how much they say about the product: a real packshot from Open Food Facts, the
produce item's own icon, then the placeholder glyph. Produce never has an
`imageUrl` — it is a kind of thing, not a package — so without the middle case
every picked item arrived at the sheet as an empty grey box.
`produceForCatalogueKey` recovers the item from the `produce:` key, so no other
add path has to carry produce-shaped fields it has no use for.

## Open Questions

- **What a produce icon actually is.** Emoji is in place and is not the intended
  answer: there is no glyph for parsnips, celeriac, kohlrabi or okra, and a
  carrot standing in for a parsnip reads as the wrong item rather than a missing
  picture. Investigated, with results recorded here so the work is not repeated:
  - `openfarmcc/open-crop-icons` is **CC0**, 247 icons, and covers **77 of our
    103** with real drawings. It is strongest exactly where emoji is weakest
    (parsnip, celeriac, kohlrabi, radicchio, okra, swede, salsify) and has **no
    citrus and no common fruit at all** — bananas, oranges, lemons, grapes,
    pineapple, mango, kiwi, avocado are all absent.
  - Wikimedia Commons full-text search is **not usable unattended**: it matches
    the word, not the thing. It returned an elephant for "kumquat", the EU
    organic logo for "mango", a chemistry pathway diagram for "rhubarb" and a
    Swiss coat of arms for "cranberry". Every candidate needs a human to look at
    it. `upload.wikimedia.org` also rate-limits hard (HTTP 429 through backoff
    to ~160s), and 5 items — tangerines, clementines, dragon fruit, gooseberries,
    bean sprouts — had no CC0/PD candidate at all.
  - `qlmanage -t -s 96 -o <dir> <svg>` rasterises SVG on macOS with no
    `brew install`, which is how the 77 were rendered and checked.

  Deferred to the user. `ProduceIcon` is the only file that changes, whatever
  the answer.

- **Whether "Herbs & aromatics" earns its own group** — **settled during
  curation: yes.** Ten items survived, enough for a section rather than noise.
