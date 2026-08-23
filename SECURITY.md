# Security notes

## Threat model

This app has no accounts, no backend, and no analytics. All data — your pantry,
your catalogue, your locations, and the cached products — lives on the device in
AsyncStorage. Exactly one network call leaves the app: a product lookup to Open
Food Facts over HTTPS, sending only the scanned barcode.

Three consequences worth knowing:

- Open Food Facts sees your IP address and every barcode you scan.
- Open Food Facts is **community-editable**, so product names, brands and image
  URLs are untrusted input. `src/api/openFoodFacts.ts` normalizes them and
  drops any image URL that isn't plain `https://`. The response stays typed
  `unknown` until `isRecord`/`asString` have checked each field — annotating it
  as a `Product` would be an assertion, not a check, and would let a vandalized
  record through with the type system vouching for it.
- Backup export puts your whole pantry into a file you then hand to the OS
  share sheet (or a browser download). Where it goes after that is outside the
  app's control — that is the user's choice, and it is the only way data leaves
  the device besides the barcode lookup.

### Two more untrusted inputs

**A backup file being imported.** It arrives through `expo-document-picker`
from anywhere the OS can reach, and it is untrusted on exactly the same terms as
an Open Food Facts record: it can be hand-edited, truncated by a transfer, or be
some other JSON file entirely. `parseBackup` (`src/lib/backup.ts`) checks it
field by field. The failure policy is deliberately asymmetric — a structural
failure rejects the whole document, while one malformed record is dropped and
*reported*, because rejecting a hundred-item backup over a single bad entry
would cost the user their pantry. `src/lib/backupFile.ts` is the only module
that touches the filesystem or the share sheet, which keeps the parsing
testable with no native mocks.

**A `barcode` query parameter on a route.** `src/lib/devScan.ts` lets a URL
inject a barcode into the scan handlers, because the iOS Simulator has no
camera and the whole scan path would otherwise be unreachable to an automated
flow. Two things keep it from being a liability:

- It is gated on `__DEV__`, which Metro replaces with `false` in a production
  build, so the branch is dead code that minification drops. A link cannot make
  a shipped build fabricate a scan.
- The value still goes through `extractBarcode`. Test-only code that skips
  validation is how a validation bypass ends up shipping; this is not that.

What it does *not* exercise is the decode itself — that is `expo-camera`'s job.
Everything downstream of the decode is real.

### Scanning on web is gated on a capability check, not a try/catch

`expo-camera` on web falls back to a WASM polyfill (`barcode-detector` →
`zxing-wasm`) whose default `locateFile` fetches the engine from jsdelivr at
runtime. That is a second network call, to a CDN, outside every control in this
document, and it breaks the offline guarantee. `src/lib/scanning.ts` therefore
offers scanning only where the browser has a **native** `BarcodeDetector` —
tested with `getSupportedFormats()`, not `typeof BarcodeDetector`, because the
constructor can exist while the platform behind it reads nothing.

## The 18 `npm audit` findings

`npm audit` reports 18 vulnerabilities (11 high, 7 moderate). They collapse to
**two** root advisories, and neither is fixable today. They are accepted risks,
not oversights.

| Advisory | Package | Path | Why it's accepted |
|---|---|---|---|
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | `image-size@1.2.1` | `metro` → bundler | DoS via malformed ICNS/JXL/HEIF. Metro only parses the six PNGs in `assets/`, which we control. No attacker input reaches it. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `uuid@7.0.3` | `xcode` → `@expo/config-plugins` | Buffer bounds check in `v3/v5/v6` when `buf` is passed. Only runs during `expo prebuild`, which this project never does (it targets Expo Go). |

**Neither package ships in the app bundle.** Both are build-time tooling.

### Why `npm audit fix` does nothing

`npm audit fix` only upgrades within the semver ranges the dependency tree
already allows. No patched version exists inside those ranges:

- `image-size` is vulnerable at `<=2.0.2`, which covers every `1.x`. Metro
  requires `^1.0.2`, so there is no in-range fix — reaching a patched release
  means a major bump to `2.x`, which changes the module's exports and would
  likely break the bundler.
- `uuid` is vulnerable at `<11.1.1`. `xcode` requires `^7.0.3`, four majors
  behind, and `uuid` dropped its default export in v9.

### Why not `npm audit fix --force`

It resolves the tree by installing **`expo@53`** — four SDK majors backwards,
from SDK 57. That trades two unreachable build-time DoS bugs for a large,
genuinely outdated dependency tree. It is strictly worse. Don't run it.

### What would actually fix it

Upstream: Expo/Metro bumping `image-size`, and `@expo/config-plugins` bumping
`xcode`/`uuid`. Both are tracked by Expo. Re-check on each SDK release.

If you ever need a clean audit before then, `overrides` in `package.json` can
force patched versions — but it is untested against Metro and can break the
bundler, so it needs verification with a real `npx expo start` run.

### Keeping the signal useful

So that these two known findings don't hide a *new* one, run:

```bash
pnpm audit
```

It fails only on advisories outside the `audit.ignore` allowlist in
`pnpm-workspace.yaml`. Review that list on the date noted beside it.

## Dependency policy

See "Dependency policy" in `AGENTS.md`. The controls are:

- **Cooldown** — `minimumReleaseAge: 10080` in `pnpm-workspace.yaml` refuses any
  version published less than 7 days ago, transitive dependencies included, and
  re-verified against every lockfile entry on install.
- **Cooldown exemptions** — `minimumReleaseAgeExclude` holds 8 Expo packages
  (`expo@57.0.14`, `@expo/cli@57.0.16`, `@expo/config@57.0.8`,
  `@expo/fingerprint@0.20.8`, `@expo/inline-modules@0.1.6`,
  `@expo/log-box@57.0.3`, `expo-asset@57.0.12`, `expo-constants@57.0.12`).
  pnpm wrote these itself during the npm→pnpm migration so `pnpm import`
  wouldn't fail on versions already pinned by `package-lock.json`. **Reviewed
  and accepted:** all eight are first-party Expo SDK 57 packages that were
  already installed and running before the cooldown existed, so it could not
  have protected against them retroactively. Each is pinned to an exact
  version, so the exemption does not carry forward to future releases.
- **No install-time execution** — `strictDepBuilds` is on by default, so an
  install fails outright if any dependency has an unreviewed build script.
- **Reproducibility** — `pnpm install --frozen-lockfile` everywhere, including CI.
- **Registry only** — never add a git dependency: registry tarballs skip their
  `prepare` scripts, git dependencies run them.
- **Automated update proposals** — Dependabot, configured in
  `.github/dependabot.yml`. It proposes; the controls above still decide. See
  below.

### Dependabot (2026-08-23)

`.github/dependabot.yml` watches two ecosystems: `npm` (which is how Dependabot
reads `pnpm-lock.yaml` — lockfileVersion 9.0, what pnpm 11 writes) and
`github-actions` for the workflow's pinned action tags.

**Dependabot proposes; it does not decide.** Every PR it opens still goes
through CI: `pnpm install --frozen-lockfile`, `pnpm audit`, typecheck,
`check:no-js`, lint and the test suite. `strictDepBuilds` still fails the
install if a bumped package has picked up a build script. A green Dependabot PR
means the controls held, not that review is optional.

**There are two cooldowns, and they are not the same control.**

| | Where | Window | What it does |
|---|---|---|---|
| pnpm `minimumReleaseAge` | `pnpm-workspace.yaml` | 7 days | *Enforces.* Re-checked against every lockfile entry on every install, transitive dependencies included, CI included. Nothing gets in under it. |
| Dependabot `cooldown` | `.github/dependabot.yml` | 14 days | *Suggests.* Direct dependencies only, and only for the PRs Dependabot chooses to open. |

The Dependabot window is the wider of the two deliberately. **14 must stay ≥ 7:**
if it ever drops below pnpm's window, Dependabot would open PRs whose lockfiles
pnpm then refuses to install, and each would fail CI with
`ERR_PNPM_NO_MATURE_MATCHING_VERSION`. Raising pnpm's `minimumReleaseAge` past
14 days has the same effect and needs the Dependabot value raised with it.

**Cooldown does not apply to Dependabot security updates.** That is the intent —
a fix for a live advisory should not sit for two weeks. Those PRs arrive as soon
as the advisory does, and the 7-day pnpm floor is what still holds underneath
them.

**What Dependabot is not allowed to touch.** The Expo SDK ships as a matched
set: the JS packages, `react-native`, and the native modules compiled into Expo
Go all have to agree, and `bundledNativeModules.json` is the authority. A
lockfile bump cannot make that decision, so majors on `expo`, `expo-*`,
`@expo/*`, `react`, `react-dom`, `react-native-*` and `jest-expo` are ignored,
as are minors on `react-native` itself — it is 0.x, so minor is its breaking
axis. Upgrading the SDK is `npx expo install --fix`, deliberately, not a PR that
happens to be green. `typescript` majors are ignored for the same reason: the
pin tracks what the SDK expects, and TypeScript 7 is ahead of Expo.

`versioning-strategy: increase-if-necessary` keeps the semver ranges in
`package.json` as written. The default (`increase`) rewrites them to match each
new version, which would walk the `~57.0.x` Expo pins off SDK 57 one PR at a
time.

### Dependabot alerts and security updates

Alerts are a **repository setting**, not a file in the repo — nothing committed
here can turn them on. Enable in GitHub → Settings → Advanced Security:

- **Dependabot alerts** — advisories against the dependency graph.
- **Dependabot security updates** — PRs that fix them. Not subject to the
  14-day cooldown, by design.

`pnpm audit` in CI covers the same ground on a weekly cron and on every push, so
the two overlap on purpose: the alert is the fast path, the CI gate is the one
that blocks a merge. Accepted advisories are listed under `audit.ignore` in
`pnpm-workspace.yaml` and explained above — Dependabot has no view of that
allowlist, so it will keep raising the three accepted findings. Close them with
a reference to the rationale rather than re-litigating each time.

### Version pins made to satisfy the cooldown (2026-08-22)

Adding Expo Router hit the cooldown head-on. `npx expo install` asked for
`expo-router@~57.0.15`, `expo-constants@~57.0.13` and `expo-linking@~57.0.7`,
all published 2026-08-20 — inside the 7-day window — so the install failed with
`ERR_PNPM_NO_MATURE_MATCHING_VERSION`. The `~` ranges meant no older version
satisfied them either.

**Resolved by installing the newest versions that had already aged past the
cooldown**, one or two patches behind: `expo-router@~57.0.13`,
`expo-constants@~57.0.11` (resolved to the already-grandfathered 57.0.12) and
`expo-linking@~57.0.6`. No `minimumReleaseAgeExclude` entry was added — that
list is meant to shrink, and exempting the exact packages the cooldown is there
to protect would defeat it. This is the cooldown working as designed, not a
workaround for it.

The trade-off is that these sit below what the SDK 57 version map wants, so
`expo start` prints an update notice and **`npx expo install --fix` will fail
until 2026-08-27**, when the blocked versions age past the window. One
`--fix` after that date catches everything up.

### Backup dependencies, pinned to matured versions (2026-08-23)

`add-pantry-export` needed three first-party Expo modules. Two of them had
patches published inside the 7-day window, so the same rule as above applied:
**take the newest version that has already aged past the cooldown**, rather than
exempting it.

| Package | Installed | Published | Latest at the time | Published |
|---|---|---|---|---|
| `expo-file-system` | 57.0.4 | 2026-08-14 | 57.0.5 | 2026-08-20 |
| `expo-sharing` | 57.0.12 | 2026-08-14 | 57.0.14 | 2026-08-20 |
| `expo-document-picker` | 57.0.1 | 2026-07-15 | 57.0.1 | — |

No `minimumReleaseAgeExclude` entries were added. All three resolve to
`registry.npmjs.org` by integrity hash, none ships a build script, and
`pnpm audit` reports no advisory beyond the three already accepted below.

These join the versions that the 2026-08-27 `expo install --fix` will catch up.

### `overrides` in `pnpm-workspace.yaml`

Two transitive packages are pinned, both because a `*` peer range let pnpm
resolve something the app cannot actually run against:

- **`react-native-worklets: 0.10.1`** — `@expo/ui` (a dependency of
  expo-router) declares the peer as `*`, so pnpm auto-installed 0.11.4. Expo Go
  for SDK 57 ships worklets **0.10.1** natively
  (`node_modules/expo/bundledNativeModules.json`), and `expo-modules-core`
  declares the peer as `^0.7.4 || ^0.8.0 || ^0.9.0 || ^0.10.0` — 0.11.4
  satisfies neither. A JS/native worklets mismatch is a startup crash, not a
  warning. Nothing in this codebase imports `@expo/ui` or worklets; the pin
  exists so an unused transitive cannot break the app.
- **`@react-native/metro-config: 0.86.2`** — same shape one layer down.
  Worklets declares it as `*`, pnpm reached for 0.87.0, while
  `@react-native/community-cli-plugin@0.86.2` pins it to exactly 0.86.2. The
  `@react-native/*` packages ship as a matched set with `react-native` itself.

Both are exact pins, both aged well past the cooldown, and `pnpm peers check`
is clean with them in place. **Revisit on every SDK upgrade** — the correct
worklets value is whatever `bundledNativeModules.json` says.

## Tooling outside the dependency policy

Two tools are installed **outside** npm entirely: the OpenSpec CLI
(`npm install -g`) and Maestro (Homebrew). Both are deliberate — they keep
dev-only tooling out of `pnpm-lock.yaml` — but the same caveat applies to each:
**none of the controls above reach them.** Neither ships in the app bundle and
neither runs on a user's device, which is the same category as the accepted
`pnpm audit` findings.

### Maestro (E2E)

Installed with `brew install mobile-dev-inc/tap/maestro`. It adds **no npm
packages**, so the lockfile, the cooldown and `strictDepBuilds` are all
untouched by it — and, critically, it needs **no `expo prebuild`**.

That last point is load-bearing. The acceptance of GHSA-w5hq-g745-h8pq above
rests entirely on prebuild never running. Detox was ruled out for exactly this
reason: it needs the native `ios/`/`android/` projects. So would Maestro Cloud
or EAS Workflows, which need an app *binary*. **Local Maestro against Expo Go is
the only E2E path that keeps this document true as written** — moving E2E into
CI would invalidate the rationale, not merely inconvenience it.

Maestro is a Homebrew formula, so it carries no cooldown, no integrity pinning
and no re-verification, and `brew upgrade` will move it without asking. It runs
an interactive installer that writes to `~/.maestro`. Treat a version bump the
same way as an OpenSpec one: deliberate, and noted here if anything changes.

### OpenSpec

The OpenSpec CLI (`@fission-ai/openspec`) is installed globally with
`--ignore-scripts`. None of the controls above reach it:

- **No cooldown.** `minimumReleaseAge` is a pnpm *resolution* setting; a global
  `npm install -g` never consults it. `1.10.0` was installed on 2026-08-22,
  three days after its 2026-08-19 publication — inside the 7-day window the
  policy exists to cover. Accepted knowingly rather than overlooked.
- **No lockfile, no integrity pinning, no re-verification.** The pre-commit
  hook checks `pnpm-lock.yaml`; a global install never appears there.
- **No `strictDepBuilds` gate.** Installed with `--ignore-scripts`, and the
  package declares no `install`/`postinstall`/`prepare` hooks, so nothing ran.
  Re-check on every upgrade: `npm view @fission-ai/openspec scripts`.

### Outbound traffic from the tooling

The *app* still makes exactly one network call (see Threat model). Maestro adds
none — it drives a local simulator over a local dev-server URL. OpenSpec adds
two, both operator-controlled:

- **Telemetry is disabled.** OpenSpec collects anonymous usage stats by
  default; it is switched off via `telemetry.enabled: false` in
  `~/.config/openspec/config.json`. That file is global, not per-project, so
  the setting is not restored by cloning this repo — re-check it on a new
  machine with `openspec config get telemetry.enabled`.
- **`openspec feedback "<msg>"` posts to the vendor.** The pre-approved
  `Bash(openspec:*)` rule in `.claude/settings.json` is a prefix wildcard, so
  it covers `feedback` and `config` as well as the read-only subcommands.
  Narrow the rule to specific subcommands if you want an explicit gate there.

`.claude/settings.json` is committed, so that allowlist entry applies to
everyone who clones the repo, not just the machine that added it.
