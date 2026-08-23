# End-to-end flows

Jest and RNTL assert on the element tree. They cannot see whether an element is
*reachable* — on screen, not behind the tab bar, not stretched to the full page
height, with a way back out. Every bug found by hand in this project so far has
been in that gap, and none of them failed a unit test.

These flows exist to close it. They are deliberately few: one per class of bug
that has actually bitten, not a re-test of logic the reducer already covers.

## Running them

Maestro is a **separate install**, like the OpenSpec CLI — it adds no npm
packages and needs no `expo prebuild`, so the GHSA-w5hq-g745-h8pq rationale in
SECURITY.md is untouched.

```bash
brew tap mobile-dev-inc/tap
brew install mobile-dev-inc/tap/maestro
```

It drives **simulators only** — there is no physical-iPhone support, and the iOS
simulator needs full Xcode, not just the Command Line Tools.

```bash
pnpm exec expo start            # leave running; note the exp:// URL
xcrun simctl boot "iPhone 16"   # or open Simulator.app
maestro test .maestro/          # runs every flow
maestro test .maestro/add-hub-reachable.yaml   # or just one
```

The app runs inside the Expo Go container, so a flow cannot `launchApp` with our
own bundle id — `appId` is Expo Go's, `host.exp.Exponent`, and the flow opens
the dev server URL instead:

```yaml
- openLink: ${EXPO_URL}
```

`EXPO_URL` defaults to `exp://127.0.0.1:8081` in each flow's header. Change it
if `expo start` picked a different port.

## The flows

| Flow | What it covers |
|---|---|
| `seed-pantry.yaml` | Not a test — puts real products in by typing names, so every later flow has something to act on. Run it first. |
| `add-hub-reachable.yaml` | Every way into the pantry is on screen and tappable, not behind the tab bar. |
| `scan-has-a-way-out.yaml` | The full-bleed camera screen still has a visible, working way back. |
| `resume-without-reloading.yaml` | An unfinished rapid-scan session offers resume/discard, and resuming doesn't reload the app. |
| `scan-to-pantry.yaml` | A barcode going in one end and a pantry entry coming out the other. |

`subflows/add-by-name.yaml` is the shared "add one product by typing its name"
sequence, run with `runFlow` and a `NAME` variable.

## Three things that only running them revealed

**Maestro cannot match plain text in this app.** `maestro hierarchy` returns
simulator chrome and nothing else, while `testID`s resolve fine. So every
selector is an `id:` — not a stylistic preference but the only thing that works.
It happens to be what you'd want anyway: text selectors break when a label is
reworded, and this app's copy changes often. `testID` becomes the accessibility
identifier, which Maestro matches with `id:`. Only the elements these flows
drive carry one; there's no value in decorating the whole tree.

**Every flow must `stopApp` first.** `openLink` against an already-running Expo
Go only brings it to the front — it does not navigate. Without `stopApp` a flow
silently inherits whatever route the previous one left behind, and passes or
fails for reasons that have nothing to do with it. Give the OS a beat after
`stopApp` too: `openLink` fired immediately after it intermittently times out.

**A cold start needs an explicit wait for the tab bar**, not a guessed `sleep`.
The first load has to fetch and evaluate the JS bundle, and how long that takes
is not a constant.

Environment variables belong in each flow's own header, not in a
`.maestro/config.yaml` — a single-file run (`maestro test .maestro/one.yaml`)
never reads that file, so config-level env works in the directory run and
vanishes in the one you use while debugging.

## Driving the scan path without a camera

**The iOS Simulator has no camera** — not a disabled one, an absent one. Left
alone, that makes every scanning path unreachable on the only device an
automated flow can drive: the lookup, the debounce, the session, the merge rule
and the whole review screen.

So in **development only**, a route may be given a `barcode` query parameter,
and the scan screens feed it to exactly the same handler the camera calls
(`src/lib/devScan.ts`):

```yaml
- openLink: ${EXPO_URL}/--/add/scan?barcode=3017620422003
```

`devBarcodesFrom` takes a comma-separated list for rapid mode. Both return
nothing when `__DEV__` is false — Metro replaces it with `false` in a production
build, so the branch is dead code that minification drops, and a link cannot
make a shipped build fabricate a scan. The value still goes through
`extractBarcode`; a query parameter is untrusted input like any other, and this
must not become the one path that skips validation.

**What this does not test is the decode itself.** That is `expo-camera`'s job,
not ours, and pretending otherwise would be the lie that makes test-only code
dangerous. Everything downstream of the decode is real.

The Android emulator's virtual camera *can* be pointed at a supplied image, so a
flow that covers the decode is possible there. That is the only route to
automating it without a physical device, and it is not built yet.

## Running against EAS would undo the point

Maestro Cloud and EAS Workflows need an app *binary*, which means a build, which
means `expo prebuild` — the same trap that ruled out Detox, and the thing
SECURITY.md's acceptance of GHSA-w5hq-g745-h8pq rests on never happening. Local
against Expo Go is the only E2E path that keeps that document true as written.
