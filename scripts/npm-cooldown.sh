#!/bin/sh
#
# Install packages only if they've been on the registry for a while.
#
# Most npm supply-chain compromises are caught and unpublished within days of
# the malicious version going up. Refusing to install anything newer than a
# week means those never reach this machine.
#
#     ./scripts/npm-cooldown.sh install some-package
#     ./scripts/npm-cooldown.sh update
#
# or via npm:  npm run add -- some-package
#
# Override the window if you genuinely need something newer:
#     COOLDOWN_DAYS=0 ./scripts/npm-cooldown.sh install some-package

set -eu

COOLDOWN_DAYS="${COOLDOWN_DAYS:-7}"

# BSD date (macOS) first, then GNU date (Linux/CI).
cutoff=$(date -u -v-"${COOLDOWN_DAYS}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null) \
  || cutoff=$(date -u -d "${COOLDOWN_DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ)

echo "npm-cooldown: resolving against the registry as of ${cutoff}"
echo "npm-cooldown: lifecycle scripts disabled for this install"
echo

# --before  makes npm resolve versions as though today were the cutoff date.
# --ignore-scripts  stops a fresh dependency from running code at install time.
#   (It's a per-command flag on purpose: setting ignore-scripts in .npmrc would
#   also stop `npm start` and `npm test` from working.)
set -x
exec npm "$@" --before="$cutoff" --ignore-scripts
