## Why

The produce picker draws its icons from two sources in two styles, and neither
is coherent on its own.

77 items use bundled artwork from `open-crop-icons`, a community seed catalogue
whose contributors shared no palette, line weight or canvas — so a clean flat
carrot sits beside a fussy over-detailed kohlrabi, and the grid reads as a
scrapbook rather than a set. The remaining 26 — every citrus, plus bananas,
grapes, pineapple, mango, kiwi and avocado — fall through to emoji, which is a
different medium entirely: glossy, vendor-styled, and rendered by the OS rather
than by us.

The icon is the whole reason the picker is a grid. If it does not read at a
glance, the grid is just a slower list, and the user is back to reading 103
names one at a time — which is what the picker was built to avoid.

## What Changes

- **One flat illustrated set covering all 103 items**, sharing a palette, a
  stroke treatment, a canvas size and optical padding, so every icon carries the
  same visual weight in a 34pt tile.
- **Complete coverage is the bar for shipping.** No item falls back to a
  different medium. An item that cannot be sourced is resolved inside this
  change — redrawn, given an acceptable substitute, or removed from the produce
  list with the reason recorded — never left mismatched.
- **The emoji fallback goes away.** Once every item has artwork, `ProduceItem`'s
  `emoji` field and the fallback branch in `ProduceIcon` are removed rather than
  left as dead code that quietly re-enables a two-style grid the next time
  someone adds an item.
- **A test enforces the contract**: adding a produce item without artwork fails
  the suite. That is what keeps coverage complete after this change closes,
  rather than making it a promise someone has to remember.
- **Provenance is recorded per asset**, not per set: where each icon came from,
  under what licence, and when — because a mixed-origin set is exactly the kind
  that becomes unauditable.

**Not in this change**: photographs, and monochrome silhouettes. Both were
considered and rejected — see design.md. The picker's layout, search, grouping,
identity scheme and add flow are all untouched; this changes what is drawn
inside a tile and nothing about how tiles behave.

## Capabilities

### New Capabilities
- `produce-icons`: what a produce icon is, the guarantee that every item has one
  in a single coherent style, and the provenance and offline constraints on the
  artwork behind it.

### Modified Capabilities

None. `produce-picker` is still an unarchived delta under
`add-produce-picker`, and its requirements cover browsing, searching, identity
and categorisation — none of which change here. The icon contract is genuinely
separable: it is about what a tile draws, not about how the picker behaves.

## Impact

**Modified**
- `assets/produce/` — every asset replaced or re-processed; 26 new ones added.
- `src/data/produceIcons.ts` — the key→asset map grows to cover all 103. The
  `require` calls stay literal; Metro reads the string at build time, so a
  computed path fails at runtime and only for items nobody opened.
- `src/data/produce.ts` — `emoji` removed from `ProduceItem` and every row.
- `src/components/ProduceIcon.tsx` — the fallback branch goes; the component
  becomes a single path.
- `src/screens/__tests__/ProduceAddScreen.test.tsx` — the test asserting an item
  still on the emoji stopgap is no longer meaningful.

**Unchanged**: the picker's layout, `src/lib/produce.ts`, the identity scheme,
the reducer, and every other add path.

**Dependencies**: none added. No native modules, no npm packages, Expo Go
intact. Nothing is fetched at runtime, at install time, or in CI — the assets
are committed, which is what makes the offline guarantee structural rather than
a promise.

**Bundle**: `assets/produce` is 824 KB today for 77 PNGs at 128px. Completing
the set at the same size lands near 1.1 MB. The design records the size actually
reached; a material overrun is a finding, not a detail.

**Prerequisite**: `add-produce-picker` implemented. It is. This change does not
require it to be archived first.
