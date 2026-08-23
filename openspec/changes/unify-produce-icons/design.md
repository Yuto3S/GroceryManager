## Context

See proposal.md — Why. What constrains the approach:

- **The current 77 are not a set.** Measured across the source SVGs, distinct
  fill colours per icon run from **3 to 261, median 35** (leeks alone has 248,
  carrots 35, basil 12). These are traced illustrations with dozens of
  near-identical shades — `#81AC66`, `#81AD66`, `#82AD67` in one file — not flat
  vector art with a shared palette. Any plan that assumes "recolour them to
  match" is arguing with that number.
- **26 items have no candidate in that set at all**: every citrus, bananas,
  grapes, pineapple, mango, kiwi, avocado, papaya, lychee, dates, and the rest.
  The set is a seed catalogue — it knows 40 pepper varieties and no oranges.
- **Bulk automated sourcing does not work.** `upload.wikimedia.org` returns
  HTTP 429 through backoff to ~160s; the FoodKeeper host returns Akamai *Access
  Denied* to anything that is not a browser. Commons full-text search matches
  the *word*, not the thing: it returned an elephant for "kumquat", the EU
  organic logo for "mango", a chemistry pathway diagram for "rhubarb" and a
  Swiss coat of arms for "cranberry". Every candidate needs a human to look at
  it. This is recorded so it is not rediscovered.
- **Tooling available with no install:** `qlmanage -t -s <px> -o <dir> <file>`
  rasterises SVG on macOS. Contact sheets can be built by embedding PNGs as
  base64 inside one SVG and rasterising that — which is how batches get reviewed
  without opening 103 files.
- **Metro reads `require` strings at build time**, so the key→asset map stays
  literal. A computed path fails at runtime, and only for the items nobody
  opened.

## Goals / Non-Goals

**Goals:**

- One set, 103 items, no second medium anywhere in the picker.
- Recognisable at 34pt — including telling ten leafy herbs apart, which is the
  failure that started this.
- Licence-clean per asset, auditable per asset.
- No new dependency, no fetch at any point, Expo Go intact.

**Non-Goals:**

- **Photographs.** Rejected on bundle (~1.5–2.5 MB against ~1.1 MB), on 103
  individual licence checks, and because free produce photography is
  encyclopedic rather than product shots — a parsnip on a wooden table, a field
  of kale — so a consistent grid would need a cutout pass per item on top of the
  sourcing.
- **Monochrome silhouettes.** Consistency by construction, and it would work for
  carrots. It fails exactly where this change is aimed: ten herbs become ten
  similar blobs, which is the problem the user reported, restated in green.
- **Redrawing the picker.** Layout, search, grouping, identity and the add flow
  are settled and untouched.
- **An icon component per item.** One component, one map, as now.

## Decisions

### The set is chosen, not assembled

The default plan is a **single existing icon family** that already covers most
of the 103, with the remainder produced in that family's style — rather than
continuing to collect one-off icons from wherever each item happens to be
available.

*Why:* consistency is a property of a source, not of a post-processing step. The
current set is the experiment that shows this: 77 icons from one repository
still do not match, because that repository accepted contributions without a
style guide. Assembling from several sources cannot do better than its worst
member, and every added source multiplies the licence surface.

*What this means for sourcing:* the first task is a survey of candidate
families, judged on coverage of *our* 103 keys, licence, and whether the style
survives at 34pt. That survey's output is a decision recorded in this file, not
a fait accompli — if no family clears the bar, that is a finding to bring back,
not a reason to quietly fall back to a mixture.

### Coverage is complete before this ships, and a test says so

A test walks the produce list and fails naming any item without artwork, and
fails again for any asset whose key matches no item.

*Why both directions:* the first keeps the grid from regressing to two styles
the next time someone adds an item. The second stops a removed item's picture
from lingering in the bundle, which is the kind of thing nobody ever notices.

*Why a test rather than a checklist:* the completeness requirement outlives this
change. A checklist protects the day it is written; a test protects every day
after.

### The emoji field goes, once and not before

`ProduceItem.emoji` and `ProduceIcon`'s fallback branch are removed in the same
change that completes coverage.

*Why not keep it as a safety net:* a fallback that never fires is dead code, and
a fallback that *can* fire silently re-permits the two-style grid this change
exists to remove. With the completeness test in place, an item without artwork
should fail the build — loudly — rather than render something plausible.

*Ordering:* removal comes last. Deleting the field before every item has
artwork would break the picker for the items still relying on it.

### Sizing stays at 128px unless the survey changes the format

A tile draws at 34pt, which is 102 physical pixels on a 3× screen, so 128px is
the smallest round size that is never upscaled.

*Open where it depends on the source:* if the chosen family ships SVG that can
be rendered natively, resolution stops mattering and the trade becomes bundle
size versus a rendering dependency — and this app cannot add one, since
`react-native-svg` is a native module and Expo Go compatibility is
non-negotiable. That points at PNG regardless, but the survey should confirm it
rather than assume.

### Provenance is per asset

A machine-readable record per icon — source, licence, date — beside the map,
rather than one paragraph describing "the set".

*Why:* the current header describes one origin because there is one. The moment
a handful of items come from elsewhere, a single note becomes wrong in a way
that reads as right, and the set stops being auditable. Recording it per asset
costs a line each and survives the set becoming mixed.

## Risks / Trade-offs

- **No free family may cover all 103 in one style.** This is the central risk
  and the reason the survey is task 1 rather than an assumption. → If none
  clears the bar, the options are: commission or draw the gap in the chosen
  family's style, substitute a near neighbour where honest (a lemon standing in
  for a lime is a lie; "Citrus" as one item is not), or cut items from the list.
  All three are resolutions inside this change. Bring the finding back before
  picking, because that choice is the user's.

- **Redrawing by hand does not scale, and looks it.** → Which is why the plan is
  to choose a family with high coverage first and treat drawing as gap-filling,
  not as the method.

- **A visual-consistency requirement cannot be asserted mechanically.** The
  spec's "look like one set" scenarios are judged by eye. → Contact sheets make
  that judgement cheap and repeatable: the full grid on one image, reviewed
  before the change closes. The mechanical part — coverage, no orphans, source
  size — is what the tests hold.

- **Bundle growth.** ~1.1 MB projected against 824 KB today. → Stated in the
  proposal, measured as a task, and a material overrun is a finding. If the
  chosen family is heavier, the trade is explicit rather than discovered.

- **Losing the emoji field is irreversible in the data.** → It is regenerable
  from the item names if ever wanted, and the whole point is that nothing should
  want it.

## Migration Plan

No user-visible migration. Icons are presentation: nothing persisted references
an asset, and catalogue records key on `produce:<slug>`, which does not change.
A user who added Carrots before this change sees the new carrot afterwards and
keeps their entry.

Rollback is reverting the commit. The risk is asymmetric in the safe direction —
the failure mode of bad artwork is that the picker looks wrong, not that anyone
loses data.

## Open Questions

- **Which icon family.** Deliberately unresolved: it is the first task, it needs
  evidence rather than a guess, and the answer determines the gap-filling work.
  Recorded here when settled.
- **What to do with items the chosen family does not cover** — draw, substitute,
  or cut. Cannot be answered before the survey names them, and cutting an item
  is the user's call, not an implementation detail.
