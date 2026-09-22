#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# test-check-exclusive-labels.sh — regression tests for check-exclusive-labels.sh.
#
# Run this after touching that script, or periodically, to confirm the
# fixed code-injection vector (git history: the label argument used to be
# spliced directly into a `python3 -c` source string) stays fixed, and
# normal scope-conflict detection still behaves correctly.
#
# Usage: test-check-exclusive-labels.sh
# Exit codes: 0 all tests passed, 1 at least one failed.

set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="$script_dir/check-exclusive-labels.sh"

pass=0
fail=0
LAST_OUTPUT=""

# run_case DESC EXPECTED_EXIT [ARGS...]
run_case() {
  local desc="$1" expected_exit="$2"; shift 2
  local output exit_code
  output=$("$target" "$@" 2>&1)
  exit_code=$?
  LAST_OUTPUT="$output"
  if [ "$exit_code" -ne "$expected_exit" ]; then
    echo "FAIL - $desc (expected exit $expected_exit, got $exit_code)"
    echo "       output: $output"
    fail=$((fail + 1))
    return
  fi
  echo "ok   - $desc"
  pass=$((pass + 1))
}

echo "== check-exclusive-labels.sh regression tests =="

run_case "no conflict passes"                0 "Kind/Bug,Priority/High"
run_case "same-scope conflict is caught"     2 "Kind/Bug,Kind/Feature"
run_case "nested scope conflict is caught"   2 "scope/sub/a,scope/sub/b"
run_case "unscoped labels never conflict"    0 "Bug,Feature"
run_case "missing argument is a usage error" 1
run_case "--help exits 0"                    0 --help

# Injection regression: a label string crafted to break out of the Python
# string literal in the vulnerable pre-fix version must be treated as
# inert data — same exit code as any unscoped string (it has no "/"), and
# never executed.
injection_payload="x'; import os,sys; sys.stderr.write('INJECTED'); y='"
run_case "injection payload is treated as inert data" 0 "$injection_payload"
if printf '%s' "$LAST_OUTPUT" | grep -q "INJECTED"; then
  echo "FAIL - injection payload was executed (found 'INJECTED' in output)"
  pass=$((pass - 1))
  fail=$((fail + 1))
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
