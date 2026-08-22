#!/bin/sh
#
# Fail if any dependency is able to execute code at install time.
#
#     npm run deps:scripts
#
# Offline and fast — it reads package-lock.json, and cross-checks node_modules
# when it's present. Runs from the pre-commit hook whenever the lockfile changes.
#
# Three ways a package gets to run code during `npm install`:
#   1. preinstall / install / postinstall scripts
#   2. a binding.gyp, which makes node-gyp compile and run native code
#   3. being sourced from git rather than the registry — registry tarballs skip
#      their `prepare` script, git dependencies do not

set -eu
cd "$(dirname "$0")/.."

# Reviewed and accepted. Keep this list as short as you can stand.
#   fsevents — macOS file-watching bindings, an OPTIONAL dev-only dependency of
#     jest-haste-map. Native module, so it has an install script. Jest falls
#     back to polling without it; npm currently skips installing it here.
ALLOWED_INSTALL_SCRIPTS="fsevents"

ALLOWED_INSTALL_SCRIPTS="$ALLOWED_INSTALL_SCRIPTS" python3 - <<'PY'
import json, glob, os, sys

allowed = set(os.environ.get("ALLOWED_INSTALL_SCRIPTS", "").split())

lock = json.load(open("package-lock.json"))
pkgs = {k: v for k, v in lock["packages"].items() if k}

flagged = 0

def report(label, items):
    global flagged
    if items:
        flagged += len(items)
        print(f"  FAIL {label}: {len(items)}")
        for i in items[:20]:
            print(f"         {i}")
    else:
        print(f"  ok   {label}: none")

print(f"deps:scripts: {len(pkgs)} packages in package-lock.json\n")

with_scripts = [k for k, v in pkgs.items() if v.get("hasInstallScript")]
excused = [k for k in with_scripts if k.split("node_modules/")[-1] in allowed]
report("lockfile install scripts", [k for k in with_scripts if k not in excused])
for k in excused:
    print(f"       (allowlisted: {k.split('node_modules/')[-1]})")

bad_src = []
for k, v in pkgs.items():
    if v.get("link"):
        continue
    r = v.get("resolved", "")
    if not r:
        bad_src.append(f"{k} (no resolved source)")
    elif not r.startswith("https://registry.npmjs.org/"):
        bad_src.append(f"{k} -> {r}")
report("non-registry sources", bad_src)

# node_modules is the authoritative view: the lockfile flag can lag a hand-edit.
roots = glob.glob("node_modules/*/package.json") + glob.glob("node_modules/@*/*/package.json")
if roots:
    LIFECYCLE = ("preinstall", "install", "postinstall")
    live, native = [], []
    for p in roots:
        try:
            d = json.load(open(p))
        except Exception:
            continue
        s = d.get("scripts") or {}
        hits = {k: v for k, v in s.items() if k in LIFECYCLE}
        if hits and d.get("name") not in allowed:
            live.append(f"{d.get('name')}: {hits}")
        if d.get("gypfile") or os.path.exists(os.path.join(os.path.dirname(p), "binding.gyp")):
            native.append(d.get("name"))
    print(f"\n  (cross-checking {len(roots)} installed packages)")
    report("installed install scripts", live)
    report("native gyp builds", native)
else:
    print("\n  note: node_modules absent — lockfile-only check")

if flagged:
    print(f"\ndeps:scripts: {flagged} finding(s). A dependency can run code at install time.")
    print("Install with --ignore-scripts (npm run add) and review before trusting it.")
    sys.exit(1)

print("\ndeps:scripts: clean — no dependency can execute code at install time.")
PY
