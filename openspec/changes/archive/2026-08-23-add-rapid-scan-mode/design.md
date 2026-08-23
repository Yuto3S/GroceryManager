## Context

See proposal.md — Why. Requirements are in `specs/`.

This change adds no domain concepts. Entries, units, steps, the catalogue and the
merge rule all come from `add-pantry-inventory`; rapid mode is a faster producer
of the same things. The design work is almost entirely about **latency and
failure**, not about modelling.

## Goals / Non-Goals

**Goals:**

- A scan loop whose latency is independent of the network.
- Losing nothing when the app dies mid-session.
- Correcting in one pass at the end rather than confirming in a hundred passes.

**Non-Goals:**

- Web camera support beyond browsers with a native `BarcodeDetector`. See Risks.
- Any change to how a single product is added, looked up or normalized.
- Recognising products without a barcode. Loose produce is change 6.
- Editing the pantry from within a session. Review acts on the session only.

## Decisions

### The queue is local; lookups are a side effect

The scan path does exactly this, with no `await` in it:

```
   scan ──▶ extractBarcode ──▶ debounce ──▶ upsert into session ──▶ haptic
                                                   │
                                                   └──▶ lookup (background)
                                                            │
                                                            └──▶ patch item
```

Nothing on the critical path can fail slowly. A lookup that takes two seconds, or
never returns, costs the user nothing — the item is already queued, and resolution
is a patch applied whenever it arrives.

Alternative rejected: **await the lookup and show the add sheet**, i.e. today's
flow with the sheet suppressed. Even at 300 ms this makes scanning feel like it is
asking permission, and offline it fails outright — which is precisely the cellar
and back-of-the-cupboard case rapid mode exists for.

Consequence worth stating: an unresolved item is a **normal outcome**, not an
error. It flows to review as an item needing a name. This is the same mechanism
that makes offline adds work, so the two are one feature rather than two.

### Deduplication happens within the session, not against the pantry

While scanning, a repeated barcode increments the queued item. The session is
never compared against existing pantry entries until review.

This keeps the scan loop purely local — no reads across the whole pantry per scan
— and it is also correct: six yoghurts scanned together are one arrival, and the
merge rule's first clause already says arrivals together merge. Running the full
rule per scan would produce the same answer far more expensively.

### Two guards on rescanning, doing different jobs

```
  debounce (~800 ms)   the camera reads one barcode many times per second.
                       Without this, holding steady adds twenty yoghurts.
                       This is `lockRef` in the current ScanScreen, kept.

  increment beyond it  a deliberate second scan means a second item.
                       Shown as ×2 with an immediate undo, because the
                       distinction between "I scanned twice" and "the camera
                       caught it twice" is the user's intent, and only they
                       know it.
```

The undo on the acknowledgement matters more than the debounce value. Any
threshold is sometimes wrong; a visible, one-tap correction makes being wrong
cheap.

### Haptics only — audio was considered and rejected

The original argument for feedback was that the user is not looking at the
screen. That is weak: they are framing a barcode in the viewfinder, so they are.

The argument that survives is **latency**. A haptic fires instantly; the visual
acknowledgement animates in over a couple hundred milliseconds. The haptic
confirms the scan registered before the UI catches up, and distinguishes three
outcomes without anything being read.

Audio was rejected on three counts: it needs a bundled asset, the iPhone silent
switch kills it (so it fails invisibly for the many people who leave a phone on
silent permanently), and it is actively unwanted in a shop.

Haptics are unsupported on web. Every call needs a platform guard — a
`Platform.OS` check, not a try/catch swallowing an error whose cause nobody will
remember. Feedback is an enhancement; its absence must not be a failure.

### The session is persisted on every mutation

The session is a small array. Writing it on each scan rather than on a timer
costs almost nothing, and a crash does not wait for a flush interval.

```
  @pantry/scanSession/v1
  { id, startedAt, locationId, items: [{ barcode, count, product | null }] }
```

`startedAt` exists so that reopening the app days later offers *resume or
discard* instead of silently reviving a stale session. Reviving one quietly is
worse than losing it: the user would confirm forty items believing they scanned
them just now.

Given that bootstrapping is the highest-risk moment in the product's life and
this is the change that makes it fast, losing a session to a crash would be a
particularly bad way to fail.

### Session location, set once

Bootstrapping happens one physical place at a time — the fridge, then the
freezer, then the cupboard. A session-level location turns a hundred location
decisions into three.

Items keep the location they were scanned under when the session location
changes mid-way. The alternative — retroactively relabelling everything — would
silently move items the user already placed.

### Review is a separate route, not a modal

`app/add/rapid.tsx` → `app/add/review.tsx`. Two routes rather than one screen
with a mode flag, so the back gesture behaves correctly and the browser back
button works on web. This is the payoff from the router migration.

### Ordering in review is by what needs attention

Unresolved items first, everything else after. Resolved items are already correct
by construction — they carry catalogue defaults — so the review's job is to make
the small set of exceptions impossible to miss, not to present a hundred rows
democratically.

## Risks / Trade-offs

- **Web scanning works, but not the way this design assumed.** *(Spike, task
  1.1, 2026-08-23 — this replaces the original risk, which was wrong.)*

  The premise was that `BarcodeDetector` gates web scanning. It does not:
  `expo-camera@57.0.3` declares `barcode-detector@^3.0.0` as a hard dependency
  and `src/web/WebBarcodeScanner.ts` uses `globalThis.BarcodeDetector` when it
  exists and dynamically imports that polyfill when it does not. So scanning
  works in Safari and Firefox too.

  The catch is where the polyfill gets its engine. `barcode-detector` wraps
  `zxing-wasm`, whose default `locateFile` resolves to
  `https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.1/dist/...`. On a browser
  without native `BarcodeDetector` the first scan therefore fetches a WASM
  binary from a third-party CDN at runtime.

  Two consequences, neither of them about coverage:

  1. **`rapid-scan` says a session "SHALL function with no network connection at
     all".** On Chrome that holds. On Safari or Firefox offline, the polyfill
     cannot load and scanning does not start at all.
  2. **It is a runtime fetch of executable code from a host that is not
     `registry.npmjs.org`.** Every control in SECURITY.md — the cooldown, the
     integrity hashes, the registry-only rule — is about knowing what code runs.
     A CDN fetch at runtime sits outside all of them.

  Native support today: Chrome and Edge (Chrome Android fully, desktop
  partially); Safari desktop and iOS ship it disabled by default; Firefox does
  not implement it.

  This applies equally to the single-shot `/add/scan` route already shipped in
  `add-pantry-inventory`, which has no web guard.

  **Decided (2026-08-23): offer scanning on web only where the browser has a
  native `BarcodeDetector`.** Chrome and Edge get it; Safari and Firefox are told
  to use the phone. The polyfill is then never executed, so no CDN fetch ever
  happens, the offline guarantee holds everywhere scanning is offered, and
  SECURITY.md stays true as written. The cost is no web scanning in Safari,
  which is accepted: the phone is the scanner, and the typed-name and catalogue
  add paths still work in every browser.

  Rejected: allowing the polyfill (a runtime third-party code fetch, and an
  offline guarantee that quietly does not hold), and self-hosting the WASM (a
  build step and a version to keep in step, for a path the phone already
  covers).

- **A hundred queued lookups could hammer Open Food Facts.** → Bound concurrency
  and keep the existing `User-Agent` and timeout. A bootstrap is exactly the
  moment this app looks most like abuse to a free, community-run service.

- **Debounce threshold is a guess.** Too short inflates counts, too long makes
  deliberate rescans feel broken. → The undo affordance is the mitigation; tune
  the constant after real use rather than theorising.

- **Session and pantry can drift.** A session persisted for days, then confirmed,
  merges against a pantry that has since changed. → The merge rule runs at
  confirmation time against the pantry as it is then, which is why it is not run
  during scanning. The resume-or-discard prompt limits how stale this gets.

- **Scanning is more fun than reviewing.** A user may scan two hundred items and
  abandon review, creating nothing. → Persistence means the work is not lost, and
  review can be resumed. Worth watching in real use.

- **Camera + background lookups + screen awake is a battery load.** → Acceptable
  for a bounded task the user chose to start; keep-awake is released on leaving.

## Open Questions

- The debounce constant. Needs real use, and the undo affordance means getting it
  wrong is recoverable.
- ~~Whether `BarcodeDetector` coverage makes any web scanning path worth
  building.~~ **Answered by the spike — see Risks.** Coverage turned out not to
  be the question; the question is whether a runtime WASM fetch from a CDN is
  acceptable. Left for the user to decide, since it trades a working feature on
  Safari against a supply-chain rule this project takes seriously.
