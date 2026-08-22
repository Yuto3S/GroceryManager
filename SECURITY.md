# Security notes

## Threat model

This app has no accounts, no backend, and no analytics. All data (your list and
the cached products) lives on the device in AsyncStorage. Exactly one network
call leaves the app: a product lookup to Open Food Facts over HTTPS, sending
only the scanned barcode.

Two consequences worth knowing:

- Open Food Facts sees your IP address and every barcode you scan.
- Open Food Facts is **community-editable**, so product names, brands and image
  URLs are untrusted input. `src/api/openFoodFacts.js` normalizes them and
  drops any image URL that isn't plain `https://`.

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

## Tooling outside the dependency policy

The OpenSpec CLI (`@fission-ai/openspec`) is installed **globally**, not as a
devDependency. That is deliberate — it keeps a dev-only tool out of
`pnpm-lock.yaml` — but it means none of the controls above reach it:

- **No cooldown.** `minimumReleaseAge` is a pnpm *resolution* setting; a global
  `npm install -g` never consults it. `1.10.0` was installed on 2026-08-22,
  three days after its 2026-08-19 publication — inside the 7-day window the
  policy exists to cover. Accepted knowingly rather than overlooked.
- **No lockfile, no integrity pinning, no re-verification.** The pre-commit
  hook checks `pnpm-lock.yaml`; a global install never appears there.
- **No `strictDepBuilds` gate.** Installed with `--ignore-scripts`, and the
  package declares no `install`/`postinstall`/`prepare` hooks, so nothing ran.
  Re-check on every upgrade: `npm view @fission-ai/openspec scripts`.

The CLI does not ship in the app bundle and never runs on a user's device. It
is build-/authoring-time tooling, in the same category as the two accepted
`npm audit` findings above.

### Outbound traffic from the tooling

The *app* still makes exactly one network call (see Threat model). The
*tooling* adds two more, both operator-controlled:

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
