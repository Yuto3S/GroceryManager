## Why

Making the pantry useful means entering the ~100 things already in the kitchen.
With the one-at-a-time add flow that is roughly fifteen seconds and three taps
per item — around half an hour of unbroken confirm-tapping, on the user's very
first encounter with the app.

The realistic outcome is that they stop at item forty. An inventory that is 60%
true is worse than none, because the user learns not to trust it and abandons the
app. The bootstrap is the highest-risk moment in the product's life, and it is
currently served by a flow designed for the steady state of adding one thing
after shopping.

Rapid mode inverts the trade: the camera stays live, every scan is accepted
immediately with its defaults, and all the correcting happens once at the end.

## What Changes

- New **scan session**: the camera stays on and accepts scans continuously. No
  per-item sheet, no blocking on the network.
- Product lookup moves **off the scan path** entirely — barcodes are queued
  instantly and resolved in the background, so scanning never waits and works
  with no signal at all.
- Rescanning the same barcode **increments a count** rather than creating a
  duplicate, with a short debounce to absorb camera bursts.
- A **session location** is set once and applies to everything scanned in it,
  matching how bootstrapping actually happens: one shelf at a time.
- Immediate **haptic feedback** distinguishes new / duplicate / unrecognised
  without the user reading anything.
- The session is **persisted as it grows**, so a crash or a phone call does not
  lose forty scans.
- A **review step** ends the session: unresolved items first, everything else
  pre-filled, one confirmation creates all entries.

## Capabilities

### New Capabilities

- `rapid-scan`: the continuous scan session — queueing, deduplication,
  background resolution, feedback, session persistence and recovery.
- `scan-session-review`: the review pass that turns a completed session into
  pantry entries, including naming unresolved barcodes and applying the merge
  rule against the existing pantry.

### Modified Capabilities

- `pantry-entry-creation`: gains a bulk creation path. No existing requirement
  changes — the single-item add sheet behaves exactly as before — so the delta
  adds requirements rather than modifying any.

## Impact

**Depends on**: `add-pantry-inventory`. Reuses `parseQuantity`, the merge rule,
the catalogue, and the entry model wholesale — this change adds no new domain
concepts, only a faster way to produce entries.

**Added**: `app/add/rapid.tsx`, `app/add/review.tsx`, a session store, session
persistence under its own key.

**Dependencies**: `expo-haptics` and `expo-keep-awake`, both bundled in Expo Go.
Audio feedback was considered and rejected — see design.

**Platform**: the camera path is iOS-first. Barcode scanning in a browser depends
on `BarcodeDetector`, which Safari and Firefox largely lack, so rapid mode is
expected to be unavailable on web. The web build must degrade cleanly rather than
offering a control that does nothing.

**Unchanged**: `src/api/openFoodFacts.ts`, `src/lib/barcode.ts`. Rapid mode is a
new caller of both, not a change to either.
