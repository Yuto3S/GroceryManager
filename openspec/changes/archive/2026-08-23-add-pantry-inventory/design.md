## Context

See proposal.md — Why. Requirements are in `specs/`; this document covers how,
and why the alternatives were rejected.

Constraints that shape everything below:

- **Expo Go only.** No custom native modules, so no SQLite-via-native, no
  background tasks. Persistence is AsyncStorage — `localStorage` on web.
- **TypeScript `strict` + `noUncheckedIndexedAccess`.**
- **Open Food Facts is untrusted.** Community-editable. `res.json()` is `unknown`
  until checked, and that rule extends to every new field this change reads.
- **`src/lib/` is where testable logic lives**, deliberately, so security- and
  correctness-relevant code is reachable by Jest without a native build.
- **Sync is not planned, but must not be foreclosed.** See Decisions.

## Goals / Non-Goals

**Goals:**

- One quantity model that covers counted and bulk goods without special cases.
- A data shape that a sync engine could later be added behind without a
  migration of user data.
- Keep the logic worth testing out of components.

**Non-Goals:**

- Expiry dates. The schema reserves room; the feature is change 6.
- Rapid scanning. Change 3. This change ships the one-at-a-time add path only.
- Any server, account, or network write. The only network call remains the
  existing product lookup.
- Migrating existing `@grocery/*` data. See Migration Plan.

## Decisions

### One quantity model: amount + unit + step

A count is not a different concept from a mass — it is a mass model with a step
of one. Collapsing them removes an entire branch from every screen.

```
  Yoghurt   unit piece   amount 4      step 1     →  ×4      tap − → ×3
  Rice      unit g       amount 1000   step 100   →  1000 g  tap − → 900 g
  Pasta     unit g       amount 500    step 125   →  500 g   tap − → 375 g
```

Alternatives rejected:

- **Boolean presence** (`have it` / `out of it`) — cannot express half a bag of
  rice, which is most of a cupboard.
- **Fractional / percentage remaining** — requires the user to *estimate* how full
  a bag is, at the moment they are cooking. Discrete taps in real units never ask
  for a judgement. This is the difference between an interaction that gets used
  and one that gets abandoned.

The step is what makes bulk goods workable: one tap means "I used a portion", and
the arithmetic is the app's problem.

### Unit is immutable per entry

Switching an entry from `4 pieces` to grams needs the mass of one tomato, which
nothing in the system knows. Offering the switch would either invent a number or
ask the user for one mid-flow. Fixing the unit at creation costs a rare
remove-and-re-add and removes a whole class of bad conversions.

### Catalogue and cache are separate, and only one is capped

`src/lib/cache.ts` caps the offline lookup cache at 300 and evicts oldest-first.
That is right for a cache — its job is making re-scans work offline, and a bounded
one does that.

It is wrong for a catalogue. A catalogue that forgets is a catalogue that drops
your staples out of "things you've bought before" precisely because you bought
them long ago. Same key space, opposite retention policy, so: two stores.

```
  productCache   barcode → product        capped 300, LRU-ish     unchanged
  catalogue      productKey → record      unbounded, never evicts new
```

The catalogue record is also where per-product knowledge accumulates — default
unit, both step forms, default location. Later changes add to the same record
(shelf-life override, restock intent) rather than inventing parallel stores.

### Sync-shaped data now, no sync

Sync is explicitly not planned. Three of its prerequisites are nonetheless
adopted, because they are free today and expensive later:

| Decision | Cost now | Cost if retrofitted |
|---|---|---|
| UUIDs via `expo-crypto` | one import | two devices, colliding ids, no way to reconcile |
| `updatedAt` on every entity | one field | no way to order concurrent edits |
| tombstones instead of deletes | one field | deletes silently resurrect |

`makeId()`'s current `Date.now()-random` is fine on one device and not fine on
two. `expo-crypto`'s `randomUUID` is in Expo Go and works on web.

Everything else about sync — transport, conflict policy, accounts — is left
entirely open. These three decisions do not commit to any of it.

### Calendar dates are stored as `YYYY-MM-DD`, instants as epoch milliseconds

Two different things get called "dates":

- `createdAt`, `updatedAt`, `deletedAt` are **instants**. They order edits. UTC
  epoch milliseconds.
- Expiry (change 6) is a **calendar date**. `Best before 27 August` is the same
  27 August in Berlin and New York. It has no time and no timezone.

Storing a calendar date as an instant forces a fabricated time-of-day, and then
the date shifts by one whenever it is rendered in a different zone than it was
written. There is no time-of-day that survives this, because the question "when
does the 27th begin?" has no answer without fixing a timezone.

A consequence for implementation: `new Date("2026-08-27")` parses as UTC midnight
per the ES spec, then renders in local time — reintroducing the off-by-one this
decision exists to prevent. Build from local components instead. Day arithmetic
must count calendar days, not divide millisecond differences, or DST returns
3.96 days.

The schema adopts this now even though expiry arrives later, so the field is
already the right type when it lands.

### The merge rule keys on arrival time, not on shelf life alone

Six yoghurts scanned together share an expiry date, so they are genuinely one
entry with amount 6. Milk bought today and milk bought last week do not, so they
are two rows. The discriminator is whether they arrived together — shelf life is
a secondary relaxation for goods where a few days' difference is immaterial.

```
  merge if same product AND (
      same session or same local calendar day
      OR shelf life > LONG_LIFE_DAYS
      OR neither side carries an expiry date
  )
```

`LONG_LIFE_DAYS` starts at 30. Clause 2 is inert until change 6 supplies shelf
lives; clauses 1 and 3 fully determine behaviour before then, which is why this
change can ship the rule complete rather than revisiting it later.

This is a pure function of `(product, existingEntry, now)` — no I/O, a handful of
branches, and boundary cases (exactly at the threshold, midnight rollover, one
side dated) that are worth a table-driven test rather than an eyeball.

### Location is stored; category is derived

Only the user knows whether their peas are in the freezer or the cupboard — no
data source can supply it, so it must be stored and asked for. Category, by
contrast, already exists in the product data. Deriving it means the
group-by-category view costs the user nothing and asks no questions.

Locations are a **list with UUIDs, not a union type**. `'fridge' | 'freezer' |
'cupboard'` makes adding a cellar or a spice rack a migration of every existing
entry. A `locationId` makes it a row.

Location is the default grouping because it is the only one that matches a
physical act: standing at the open fridge, checking the app's Fridge section
against what is actually there. That reconciliation is what keeps the inventory
honest.

Grouping is one level deep, not nested. Category-inside-location on a phone means
two header levels and a lot of scrolling past chrome for ~100 entries.

### Sorting is alphabetical

Alphabetical within a group serves the dominant task: finding the item you just
used. Sorting by expiry is better for "what needs eating", but is meaningless
until change 6 — so it arrives with it, as an option rather than a replacement.

Row layout should reserve the slot where a date will go, so change 6 is a fill-in
rather than a re-layout. This also serves the merge rule now: two rows of the
same product must be visibly distinguishable.

### Hidden-at-zero, and why not delete

An entry at zero leaves the pantry view but is not deleted. Two reasons:

1. It is the purchase history. Change 7's suggestions have nothing to read
   otherwise.
2. Deleting would make the merge rule's "revive or create" question unanswerable.

Nothing is auto-added to any list when an entry empties. Seasonal goods and
one-off purchases would make that actively wrong; opt-in restock intent is
change 7.

Hidden entries accumulate without bound. That is correct — they are data, not
litter. If it ever becomes a problem, `capCache` is the existing pattern.

### New pure modules in `src/lib/`

Following the existing convention that logic worth testing does not live in
components:

```
  quantity.ts    quantity text (unknown) → { unit, amount, step } | fallback
  merge.ts       (product, entry, now)   → merge | separate
  pantry.ts      consume / restock / clamp-at-zero
  identity.ts    normalize a typed name → stable catalogue key
```

`quantity.ts` takes `unknown` rather than `string`, for the same reason
`extractBarcode` does: the argument is whatever a stranger typed into Open Food
Facts, and the type system cannot vouch for it.

### Store shape

`GroceryStore.tsx` becomes `PantryStore.tsx`, keeping the reducer + context
pattern and the discriminated-union `Action` with its `never` exhaustiveness
check — that check is why adding a variant without handling it fails to compile,
and it is worth preserving.

The reducer moves to its own module so it is unit-testable without rendering.
This is the largest piece of real logic in the codebase that currently cannot be
reached by a test, and this change is the moment to fix it, since the reducer is
being rewritten anyway.

Persistence stays confined to the provider. That boundary is what would later
allow a sync engine to slot in beneath it.

## Risks / Trade-offs

- **Bootstrapping is ~100 manual adds and this change ships only the
  one-at-a-time path.** The realistic outcome is that the user does not complete
  an inventory until change 3. → Accepted deliberately: rapid mode is a large
  enough flow that bundling it here would make this change unreviewable. Change 3
  follows immediately.

- **Hand-entered data lives in AsyncStorage on one device with no backup.** A
  reinstall loses it. → Change 4 is export/import, and should not slip far behind
  change 3. Worth stating plainly: between changes 3 and 4 the user is carrying
  real risk.

- **Category derivation may be mostly `Other`.** Open Food Facts tags are messy
  and typed items have none. → Check against real data early. If `Other` swallows
  a large share of entries, group-by-category is not worth shipping and should be
  cut rather than shipped bad.

- **Deleting the shopping list is unrecoverable for existing data.** → Intended.
  The data answers a question the app no longer asks. Called out here so it is a
  decision rather than a surprise.

- **The reducer rewrite touches everything at once.** → The pure modules land
  first with tests, then the reducer composes them. That way the parts most
  likely to be wrong are the parts already covered.

- **`expo-crypto` is a new dependency.** Small, first-party, in Expo Go. → The
  7-day cooldown applies as normal.

## Migration Plan

No data migration. `@grocery/list/v1` and `@grocery/productCache/v1` are
abandoned in place; the pantry writes new `@pantry/*` keys.

Rationale: the only shared concept is the product cache, and re-populating it
costs one lookup per re-scan. Writing a migration to salvage a list whose central
field (`bought`) has no meaning in the new model would be work spent producing
entries the user would then have to correct by hand.

Orphaned keys are left rather than deleted — deleting is a destructive operation
against data this change has no further use for, and leaving it costs a few
kilobytes.

## Open Questions

- Whether `LONG_LIFE_DAYS = 30` is the right threshold. It cannot be evaluated
  until change 6 supplies real shelf lives, and until then clause 2 is inert. A
  constant to revisit, not a decision to make now.
- Whether the category grouping survives contact with real data. See Risks.
