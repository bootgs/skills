#!/bin/bash
# check-latest-version.sh — queries the npm registry for the currently
# published version of apps-script-utils and compares it against what's
# installed locally, instead of trusting a version number baked into a skill.
#
# Usage: check-latest-version.sh [OPTIONS]
#
# Options:
#   --json        Emit a JSON object instead of a table row
#   -h, --help    Show this help and exit
#
# Exit codes:
#   0  success
#   1  bad usage
#   2  registry lookup failed
#
# Fetching goes through scripts/fetch_policy.py, which identifies this script
# in its User-Agent, reads robots.txt first, paces requests, and stops rather
# than retries on 403/429/503.
#
# Requires: curl, python3

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

PKG="apps-script-utils"

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
}

JSON=0
case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  --json)
    JSON=1
    ;;
  "")
    ;;
  *)
    echo "Error: unknown argument \"$1\". See --help." >&2
    exit 1
    ;;
esac

LATEST=$(FETCH_POLICY_SCRIPT="check-latest-version.sh" python3 "$HERE/fetch_policy.py" \
  "https://registry.npmjs.org/${PKG}/latest" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])" 2>/dev/null) || {
  echo "Error: could not resolve the latest version of \"${PKG}\" from the npm registry." >&2
  exit 2
}

INSTALLED_FILE="node_modules/${PKG}/package.json"
INSTALLED=""
if [ -f "$INSTALLED_FILE" ]; then
  INSTALLED=$(python3 -c "import json; print(json.load(open('$INSTALLED_FILE'))['version'])")
fi

if [ "$JSON" -eq 1 ]; then
  PKG="$PKG" LATEST="$LATEST" INSTALLED="$INSTALLED" python3 -c "
import json, os
print(json.dumps({
    'package': os.environ['PKG'],
    'latest': os.environ['LATEST'],
    'installed': os.environ['INSTALLED'] or None,
}))
"
else
  printf "%-20s latest: %-12s installed: %s\n" "$PKG" "$LATEST" "${INSTALLED:-not installed locally}"
fi
