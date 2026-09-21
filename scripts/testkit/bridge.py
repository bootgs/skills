#!/usr/bin/env python3
"""bridge.py — a JSON shim over template/scripts/fetch_policy.py.

vitest speaks JSON over a child process; the module under test speaks Python.
This is the only translation layer, and it holds no policy of its own: every
op is a thin call into fetch_policy so a test can never pass against logic that
lives only in the bridge.

Usage: bridge.py <op>   (request JSON on stdin, response JSON on stdout)

SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "template" / "scripts"))

import fetch_policy as fp  # noqa: E402


def op_user_agent(request: dict) -> dict:
    return {"agent": fp.user_agent(request["script_name"])}


def op_parse_robots(request: dict) -> dict:
    agent = fp.user_agent(request.get("script_name", "probe.py"))
    policy = fp.parse_robots(request["text"], agent)
    return {
        "allowed": policy.allowed,
        "rules": policy.rules,
        "crawl_delay": policy.crawl_delay,
        "effective_delay": policy.effective_delay(),
        "permits": {path: policy.permits(path) for path in request.get("paths", [])},
        "reason": policy.reason,
    }


def op_robots_verdict(request: dict) -> dict:
    agent = fp.user_agent(request.get("script_name", "probe.py"))
    policy = fp.robots_verdict(request["status"], request.get("body", ""), agent)
    return {
        "allowed": policy.allowed,
        "reason": policy.reason,
        "effective_delay": policy.effective_delay(),
        "permits": {path: policy.permits(path) for path in request.get("paths", [])},
    }


def op_rate_limit(request: dict) -> dict:
    """Drives RateLimiter with a fake clock so a test never actually sleeps."""
    now = [0.0]
    slept: list[float] = []

    def clock() -> float:
        return now[0]

    def sleep(seconds: float) -> None:
        slept.append(seconds)
        now[0] += seconds

    limiter = fp.RateLimiter(sleep=sleep, clock=clock)
    waits = []
    for step in request["calls"]:
        now[0] += step.get("elapsed", 0.0)
        waits.append(limiter.wait(step["host"], step.get("delay", 0.0)))
    return {"waits": waits, "slept": slept, "min_interval": fp.MIN_INTERVAL_SECONDS}


def op_stored_copy(request: dict) -> dict:
    result = fp.stored_copy_result(request["url"], request["body"], request["retrieved_at"])
    return {
        "from_stored_copy": result.from_stored_copy,
        "provenance": result.provenance,
        "body": result.body,
    }


def op_constants(_request: dict) -> dict:
    return {
        "min_interval": fp.MIN_INTERVAL_SECONDS,
        "stop_statuses": list(fp.STOP_STATUSES),
        "repo_url": fp.REPO_URL,
    }


def op_fetch(request: dict) -> dict:
    """A real fetch, over real HTTP, through the real transport."""
    fetcher = fp.PolicyFetcher(request.get("script_name", "probe.py"), timeout=request.get("timeout", 5))
    try:
        result = fetcher.fetch(request["url"])
    except fp.FetchStopped as stopped:
        return {"outcome": "stopped", "status": stopped.status, "message": str(stopped), "log": fetcher.log}
    except fp.FetchDisallowed as disallowed:
        return {"outcome": "disallowed", "message": str(disallowed), "log": fetcher.log}
    return {
        "outcome": "ok",
        "status": result.status,
        "body": result.body,
        "provenance": result.provenance,
        "from_stored_copy": result.from_stored_copy,
        "log": fetcher.log,
    }


OPS = {
    "user_agent": op_user_agent,
    "parse_robots": op_parse_robots,
    "robots_verdict": op_robots_verdict,
    "rate_limit": op_rate_limit,
    "stored_copy": op_stored_copy,
    "constants": op_constants,
    "fetch": op_fetch,
}


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in OPS:
        print(json.dumps({"error": f"usage: bridge.py <{'|'.join(OPS)}>"}, ensure_ascii=False))
        return 1
    request = json.loads(sys.stdin.read() or "{}")
    try:
        response = OPS[sys.argv[1]](request)
    except Exception as error:  # noqa: BLE001 — the test asserts on the failure
        response = {"error": f"{type(error).__name__}: {error}"}
    # ensure_ascii=False: the default escapes an em dash to —, and every
    # message in fetch_policy.py that a test matches on contains one.
    print(json.dumps(response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
