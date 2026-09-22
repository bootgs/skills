#!/bin/bash
# check-exclusive-labels.sh — catches the mistake `tea` itself can't catch:
# two labels from the same exclusive scope (e.g. "Kind/Bug" and
# "Kind/Feature") passed to the same issue/PR command. tea's label
# create/update has no --exclusive flag (that toggle only exists in the
# Gitea web UI), so tea will happily accept a conflicting label set and
# let the server-side "only one per scope" rule silently drop one of them
# — or, if the labels were never marked Exclusive in the UI, apply both.
# Catch it before the API call instead of guessing which one won.
#
# Usage: check-exclusive-labels.sh LABEL[,LABEL...]
#
# The scope of a label is everything before its LAST "/" (matching
# Gitea's own scoped-label rule) — a label with no "/" has no scope and
# is never flagged.
#
# Examples:
#   check-exclusive-labels.sh "Kind/Bug,Priority/High"        # ok, exit 0
#   check-exclusive-labels.sh "Kind/Bug,Kind/Feature"          # conflict, exit 2
#   check-exclusive-labels.sh "scope/sub/a,scope/sub/b"        # conflict, exit 2 (scope is "scope/sub")
#
# Exit codes:
#   0  no two labels share a scope
#   1  bad usage
#   2  two or more labels share a scope

set -euo pipefail

usage() {
  # The whole leading comment block, however long it grows. A fixed line range
  # silently stops covering the header the first time a line is added to it:
  # `2,20p` stopped one line short of "Exit codes:", so --help documented
  # everything except the exit statuses the caller gates on.
  sed -n '2,/^[^#]/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "Error: expected exactly one comma-separated LABEL list. See --help." >&2
  exit 1
fi

python3 -c "
import sys
labels = [l.strip() for l in sys.argv[1].split(',') if l.strip()]
scopes = {}
conflicts = []
for label in labels:
    if '/' not in label:
        continue
    scope = label.rsplit('/', 1)[0]
    scopes.setdefault(scope, []).append(label)
for scope, members in scopes.items():
    if len(members) > 1:
        conflicts.append((scope, members))
if conflicts:
    for scope, members in conflicts:
        print(f'Conflict in scope \"{scope}\": {\", \".join(members)}', file=sys.stderr)
    sys.exit(2)
sys.exit(0)
" "$1"
