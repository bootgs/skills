#!/bin/bash
# check-quotas.sh — fetches the current Google Apps Script quotas & limitations
# table directly from the official docs, instead of relying on a number
# hardcoded in a skill file (these change without notice).
#
# Usage: check-quotas.sh [OPTIONS] [KEYWORD]
#
# Prints the "Current quotas" + "Current limitations" section of the Apps
# Script quotas page. With KEYWORD, filters to matching rows only.
#
# Options:
#   -h, --help    Show this help and exit
#
# Examples:
#   check-quotas.sh                # full quotas + limitations table
#   check-quotas.sh "Trigger"      # rows mentioning "Trigger" (case-insensitive)
#   check-quotas.sh "runtime"      # execution time limits
#
# Exit codes:
#   0  success
#   1  bad usage
#   2  could not fetch or parse the docs page
#   3  KEYWORD matched no rows
#
# Requires: curl, python3

set -euo pipefail

URL="https://developers.google.com/apps-script/guides/services/quotas"

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

if [ $# -gt 1 ]; then
  echo "Error: too many arguments. Expected at most one KEYWORD." >&2
  echo "Usage: $0 [KEYWORD]  (see --help)" >&2
  exit 1
fi

KEYWORD="${1:-}"

HTML=$(curl -sL --fail "$URL") || {
  echo "Error: failed to fetch $URL" >&2
  exit 2
}

TEXT=$(echo "$HTML" | python3 -c "
import re, sys
html = sys.stdin.read()
text = re.sub(r'<[^<]+?>', ' ', html)
text = text.replace('&#39;', \"'\").replace('&amp;', '&')
text = re.sub(r'\s+', ' ', text)
start = text.find('Current quotas')
end = text.find('Monitor quota usage')
print(text[start:end].strip() if start != -1 and end != -1 else '')
")

if [ -z "$TEXT" ]; then
  echo "Error: could not locate the quotas section — the docs page structure may have changed." >&2
  echo "Open $URL directly." >&2
  exit 2
fi

if [ -n "$KEYWORD" ]; then
  if ! echo "$TEXT" | grep -oi ".\{0,15\}$KEYWORD.\{0,100\}"; then
    echo "No rows matching \"$KEYWORD\". Open $URL directly." >&2
    exit 3
  fi
else
  echo "$TEXT"
fi
