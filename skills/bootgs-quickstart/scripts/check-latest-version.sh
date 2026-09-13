#!/bin/bash
# check-latest-version.sh — queries the npm registry for the currently
# published version of bootgs and apps-script-utils, and compares it against
# what's installed locally. Run this before scaffolding a new project or
# filing a bug — a skill's guidance is written against a specific release,
# and the framework moves faster than any doc snapshot.
#
# Usage: check-latest-version.sh [OPTIONS] [PACKAGE]
#
# With no PACKAGE, checks both "bootgs" and "apps-script-utils". With
# PACKAGE, checks any single npm package by name.
#
# Options:
#   --json        Emit one JSON object per line instead of a table
#   -h, --help    Show this help and exit
#
# Examples:
#   check-latest-version.sh
#   check-latest-version.sh bootgs
#   check-latest-version.sh --json
#
# Exit codes:
#   0  success
#   1  bad usage
#   2  registry lookup failed for a requested package
#
# Requires: curl, python3

set -euo pipefail

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
}

JSON=0
PACKAGES=()

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --json)
      JSON=1
      shift
      ;;
    -*)
      echo "Error: unknown option \"$1\". See --help." >&2
      exit 1
      ;;
    *)
      PACKAGES+=("$1")
      shift
      ;;
  esac
done

if [ ${#PACKAGES[@]} -eq 0 ]; then
  PACKAGES=(bootgs apps-script-utils)
elif [ ${#PACKAGES[@]} -gt 1 ]; then
  echo "Error: expected at most one PACKAGE argument. See --help." >&2
  exit 1
fi

EXIT_CODE=0

check_package() {
  local pkg="$1"
  local latest
  latest=$(curl -sL --fail "https://registry.npmjs.org/${pkg}/latest" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])" 2>/dev/null) || {
    echo "Error: could not resolve the latest version of \"${pkg}\" from the npm registry." >&2
    EXIT_CODE=2
    return
  }

  local installed_file="node_modules/${pkg}/package.json"
  local installed=""
  if [ -f "$installed_file" ]; then
    installed=$(python3 -c "import json; print(json.load(open('$installed_file'))['version'])")
  fi

  if [ "$JSON" -eq 1 ]; then
    PKG="$pkg" LATEST="$latest" INSTALLED="$installed" python3 -c "
import json, os
print(json.dumps({
    'package': os.environ['PKG'],
    'latest': os.environ['LATEST'],
    'installed': os.environ['INSTALLED'] or None,
}))
"
  else
    printf "%-20s latest: %-12s installed: %s\n" "$pkg" "$latest" "${installed:-not installed locally}"
  fi
}

for pkg in "${PACKAGES[@]}"; do
  check_package "$pkg"
done

exit "$EXIT_CODE"
