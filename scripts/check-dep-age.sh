#!/bin/sh
#
# Verify every direct dependency (runtime AND dev) has been published for at
# least COOLDOWN_DAYS.
# The cooldown wrapper prevents fresh packages going in; this catches ones that
# got in another way (a manual `npm install`, a merged branch, a bad rebase).
#
#     npm run deps:age
#
# Needs network access — it asks the registry when each locked version shipped.

set -eu

COOLDOWN_DAYS="${COOLDOWN_DAYS:-7}"
cd "$(dirname "$0")/.."

COOLDOWN_DAYS="$COOLDOWN_DAYS" python3 - <<'PY'
import json, os, subprocess, sys, datetime

days = int(os.environ["COOLDOWN_DAYS"])
now = datetime.datetime.now(datetime.timezone.utc)

lock = json.load(open("package-lock.json"))
pkg = json.load(open("package.json"))

# devDependencies count too — they run on this machine at build/test time,
# which is a bigger blast radius than anything that ships to a phone.
direct = {}
for field in ("dependencies", "devDependencies"):
    for name in pkg.get(field, {}):
        direct[name] = field

too_new, unknown = [], []
for name in sorted(direct):
    version = lock["packages"].get(f"node_modules/{name}", {}).get("version")
    if not version:
        unknown.append((name, "not in package-lock.json"))
        continue
    try:
        out = subprocess.run(
            ["npm", "view", f"{name}@{version}", "time", "--json"],
            capture_output=True, text=True, timeout=30, check=True,
        ).stdout
        published = json.loads(out)[version]
    except Exception as e:
        unknown.append((name, f"registry lookup failed: {type(e).__name__}"))
        continue

    age = (now - datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))).days
    status = "OK " if age >= days else "NEW"
    kind = "dev" if direct[name] == "devDependencies" else "   "
    print(f"  {status} {kind} {name}@{version} — published {age}d ago")
    if age < days:
        too_new.append((name, version, age))

for name, why in unknown:
    print(f"  ??  {name} — {why}")

if too_new:
    print(f"\ndeps:age: {len(too_new)} package(s) younger than {days} days:")
    for name, version, age in too_new:
        print(f"  {name}@{version} ({age}d)")
    print("Wait out the cooldown, or record why it's needed in SECURITY.md.")
    sys.exit(1)

print(f"\ndeps:age: all {len(direct)} direct dependencies are at least {days} days old.")
print("note: transitive dependencies are not checked — see AGENTS.md.")
PY
