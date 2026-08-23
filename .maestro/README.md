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
own bundle id. It opens the dev server URL instead:

```yaml
- openLink: exp://127.0.0.1:8081
```

Change the port if `expo start` picked a different one.

## What these flows cannot reach

**The iOS Simulator has no camera.** Nothing that depends on decoding a real
barcode — rapid scan, single scan past the viewfinder, the whole review path —
can run against it. What is left is navigability and layout, which is precisely
the gap unit tests leave, so the flows are still worth having; but "green" here
is a much narrower claim than "the scan flows work".

The Android emulator *does* have a virtual camera and can be pointed at a
supplied image, so a barcode-scanning flow is possible there. That is the only
route to automating the scan path without a physical device, and it is not built
yet.

## Why testIDs rather than visible text

Text selectors break when a label is reworded or translated — and this app's
copy changes often. `testID` becomes the accessibility identifier, which
Maestro matches with `id:`. Only the elements these flows drive carry one;
there is no value in decorating the whole tree.

## Running against EAS would undo the point

Maestro Cloud and EAS Workflows need an app *binary*, which means a build, which
means `expo prebuild` — the same trap that ruled out Detox. Local against Expo
Go is the only E2E path that keeps SECURITY.md true as written.
