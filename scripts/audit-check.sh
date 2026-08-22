#!/bin/sh
#
# npm audit, minus the two advisories we've reviewed and accepted.
# Fails on anything new, so a real finding can't hide behind known noise.
#
#     npm run audit:check
#
# Rationale for each entry is in SECURITY.md. Re-check these on every Expo SDK
# upgrade, and no later than: 2026-11-17.

set -eu

# image-size (via metro) — DoS on malformed ICNS/JXL/HEIF, build-time only.
# uuid (via xcode -> @expo/config-plugins) — prebuild only, never runs here.
ALLOWED="GHSA-w3rx-r6r6-pgpr GHSA-5p2g-fcmc-qvqq GHSA-w5hq-g745-h8pq"

cd "$(dirname "$0")/.."

npm audit --json 2>/dev/null | ALLOWED="$ALLOWED" python3 -c '
import json, os, sys

allowed = set(os.environ["ALLOWED"].split())
try:
    report = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit("audit:check: could not parse npm audit output")

found = {}
for pkg, vuln in report.get("vulnerabilities", {}).items():
    for via in vuln.get("via", []):
        if not isinstance(via, dict):
            continue
        ghsa = via.get("url", "").rsplit("/", 1)[-1]
        if ghsa:
            found[ghsa] = (via.get("severity", "?"), via.get("title", ""), pkg)

new = {g: v for g, v in found.items() if g not in allowed}
stale = allowed - set(found)

for ghsa, (sev, title, pkg) in sorted(new.items(), key=lambda x: x[1][0]):
    print(f"  [{sev}] {pkg}: {title}")
    print(f"         https://github.com/advisories/{ghsa}")

if stale:
    print("\naudit:check: these allowlist entries no longer fire and can be removed:")
    for g in sorted(stale):
        print(f"  {g}")

if new:
    print(f"\naudit:check: {len(new)} unreviewed advisory/advisories. See SECURITY.md.")
    sys.exit(1)

print(f"audit:check: clean — {len(found)} known, 0 new.")
'
