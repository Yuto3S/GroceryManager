Prerequisite: `add-pantry-inventory` is merged.

## 1. Spike first

- [x] 1.1 Confirm `BarcodeDetector` support in the browsers actually targeted.
      The outcome decides whether the web build renders a rapid-mode entry point
      at all. Do this before building UI.

## 2. Dependencies

- [x] 2.1 `npx expo install expo-haptics expo-keep-awake`
- [x] 2.2 Confirm no `strictDepBuilds` approval prompt; confirm registry
      resolution with integrity hashes in the lockfile.

## 3. Session state and persistence

- [x] 3.1 Session model: `{ id, startedAt, locationId, items }`.
- [x] 3.2 Pure session reducer in `src/lib/` or `src/state/` — upsert by barcode,
      increment, decrement, drop, patch-on-resolve. No React, no storage.
- [x] 3.3 Tests for the reducer: first scan creates; rescan increments; patching
      a resolved product preserves the count; dropping the last item leaves a
      valid empty session.
- [x] 3.4 Persist to `@pantry/scanSession/v1` on every mutation, not on a timer.
- [x] 3.5 Resume-or-discard prompt on load, keyed on `startedAt`.
- [x] 3.6 Tests: a persisted session round-trips; malformed persisted JSON
      degrades to no session rather than throwing.

## 4. Scan loop

- [x] 4.1 `app/add/rapid.tsx` — `CameraView` with `onBarcodeScanned` live.
- [x] 4.2 Reuse `extractBarcode`. Decoded values with no product number are
      ignored without a lookup — do not weaken this.
- [x] 4.3 Debounce repeat reads of the same barcode (~800 ms, named constant).
- [x] 4.4 Queue synchronously; dispatch the lookup as a background side effect.
      Assert by review that no `await` sits on the scan path.
- [x] 4.5 Bound lookup concurrency. Keep the existing `User-Agent` and timeout.
- [x] 4.6 Patch the queued item when a lookup resolves; leave it unresolved on
      failure — unresolved is a normal outcome, not an error path.
- [x] 4.7 Session location control; changing it does not relabel existing items.
- [x] 4.8 `expo-keep-awake` while the session is active; release on leaving.

## 5. Feedback

- [x] 5.1 Three haptic patterns: new, duplicate, unresolved.
- [x] 5.2 Guard every haptic call with a platform check. Haptics are unsupported
      on web and must not throw there.
- [x] 5.3 Visual acknowledgement: name, count, undo. Must not block the next scan.
- [x] 5.4 Running count of items scanned.

## 6. Review

- [x] 6.1 `app/add/review.tsx`.
- [x] 6.2 Unresolved items first, with a count of what needs attention.
- [x] 6.3 Name an unresolved item, keeping its barcode for a later lookup.
- [x] 6.4 Edit count, unit, step, location per item; drop an item.
- [x] 6.5 Confirm: apply the merge rule against the current pantry, create all
      entries, populate the catalogue, clear the session.
- [x] 6.6 Leaving review without confirming creates nothing and keeps the session.

## 7. Tests

- [x] 7.1 Reuse the `expo-camera` mock from `add-pantry-inventory`.
- [x] 7.2 Mock `expo-haptics` — assert the platform guard, including that a web
      platform does not call it.
- [x] 7.3 Component tests: rescan shows an incremented count; unresolved item
      reaches review; confirming creates entries.
- [x] 7.4 A slow lookup does not block a subsequent scan.

## 8. Verify

- [x] 8.1 `pnpm run check` and `pnpm test` clean.
- [ ] 8.2 On device: scan twenty real products in one session, in aeroplane mode,
      and confirm all twenty reach review as unresolved.
- [ ] 8.3 On device: kill the app mid-session and confirm resume works.
- [ ] 8.4 On web: rapid mode is either absent or functional — never a control
      that does nothing.
