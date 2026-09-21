#!/usr/bin/env python3
"""fetch_policy.py — the fetching contract every script in this repository obeys.

A skill that pulls a figure off a vendor's docs page is a crawler, and it should
behave like one that expects to be audited:

  * The User-Agent names this script and this repository. It never impersonates
    a browser, and there is no flag to make it do so.
  * robots.txt is read before the target. An unreadable robots.txt (5xx, a
    timeout, a transport failure) disallows everything — we cannot prove we are
    allowed, so we are not. A *missing* one (4xx) allows everything, which is
    what the absence of a robots file means.
  * Crawl-delay is honoured, and we never exceed one request per second per
    host regardless of what robots.txt permits.
  * 403, 429 and 503 stop the run and are reported. They are the host saying
    no; retrying is how a polite client becomes an impolite one.
  * An answer served from a stored copy says so, so a caller never mistakes a
    cached figure for a live one.

This file is the canonical copy. Each skill that fetches vendors a byte-identical
copy so the skill stays self-contained when installed on its own;
tests/repo/vendored-fetch-policy.test.ts fails if a copy drifts.

Standard library only, plus the `curl` binary for transport — more reliably
configured with a system CA bundle across environments than Python's own SSL
context, notably on macOS Python.org installs that have never run
"Install Certificates.command".

SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import subprocess
import sys
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit, urlunsplit

REPO_URL = "https://github.com/bootgs/skills"

#: Never exceed this, whatever robots.txt permits.
MIN_INTERVAL_SECONDS = 1.0

#: Status codes that end the run. The host said no; we report rather than retry.
STOP_STATUSES = (403, 429, 503)

DEFAULT_TIMEOUT_SECONDS = 15


def user_agent(script_name: str) -> str:
    """The only User-Agent this repository sends.

    Names the script and the repository so an operator reading their access log
    can tell what hit them and where to complain. There is deliberately no
    parameter for overriding it with a browser string.
    """
    if not script_name or "/" in script_name or any(c.isspace() for c in script_name):
        raise ValueError(f"script_name must be a bare filename, got {script_name!r}")
    return f"{script_name} (+{REPO_URL})"


# --------------------------------------------------------------------------- #
# robots.txt                                                                   #
# --------------------------------------------------------------------------- #


@dataclass
class RobotsPolicy:
    """The rules that apply to us, extracted from one robots.txt."""

    allowed: bool = True
    rules: list[tuple[str, bool]] = field(default_factory=list)  # (path, allow?)
    crawl_delay: float | None = None
    reason: str = ""

    def permits(self, path: str) -> bool:
        """RFC 9309: the longest matching rule wins; a tie goes to Allow."""
        if not self.allowed:
            return False
        if not path.startswith("/"):
            path = "/" + path
        best_len = -1
        verdict = True
        for rule_path, allow in self.rules:
            if not rule_path or not path.startswith(rule_path):
                continue
            if len(rule_path) > best_len or (len(rule_path) == best_len and allow):
                best_len = len(rule_path)
                verdict = allow
        return verdict

    def effective_delay(self) -> float:
        """Never faster than one request per second per host."""
        return max(self.crawl_delay or 0.0, MIN_INTERVAL_SECONDS)


def parse_robots(text: str, agent: str) -> RobotsPolicy:
    """Parses robots.txt, preferring a group naming us over the `*` group."""
    groups: dict[str, dict] = {}
    current: list[str] = []
    starting_group = False

    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        field_name, _, value = line.partition(":")
        field_name = field_name.strip().lower()
        value = value.strip()

        if field_name == "user-agent":
            if not starting_group:
                current = []
                starting_group = True
            current.append(value.lower())
            groups.setdefault(value.lower(), {"rules": [], "delay": None})
            continue

        starting_group = False
        if not current:
            continue
        for name in current:
            bucket = groups.setdefault(name, {"rules": [], "delay": None})
            if field_name == "disallow":
                bucket["rules"].append((value, False))
            elif field_name == "allow":
                bucket["rules"].append((value, True))
            elif field_name == "crawl-delay":
                try:
                    bucket["delay"] = float(value)
                except ValueError:
                    pass

    if not groups:
        # A 200 that contains no directive at all is not a robots file. Some
        # hosts serve something else entirely at /robots.txt — registry.npmjs.org
        # returns the npm package *named* "robots.txt". RFC 9309 says content it
        # cannot parse imposes no rules, so this allows, but it says so rather
        # than reporting a successful parse of nothing.
        return RobotsPolicy(allowed=True, reason="no robots directives in the response — imposing no rules")

    token = agent.split("/", 1)[0].split(" ", 1)[0].lower()
    chosen = None
    for name in groups:
        if name and name != "*" and (name in token or token.startswith(name)):
            chosen = groups[name]
            break
    if chosen is None:
        chosen = groups.get("*")
    if chosen is None:
        return RobotsPolicy(allowed=True, reason="robots.txt names no group that applies to us")

    # A bare `Disallow:` with an empty value means "allow everything".
    rules = [(path, allow) for path, allow in chosen["rules"] if path != ""]
    return RobotsPolicy(allowed=True, rules=rules, crawl_delay=chosen["delay"], reason="robots.txt parsed")


def robots_verdict(status: int | None, body: str, agent: str) -> RobotsPolicy:
    """Turns a robots.txt fetch outcome into a policy.

    `status is None` means the fetch failed outright (timeout, DNS, transport
    error) and is treated exactly like a 5xx.
    """
    if status is None:
        return RobotsPolicy(allowed=False, reason="robots.txt could not be fetched — treating as disallow-all")
    if status in STOP_STATUSES or status >= 500:
        return RobotsPolicy(
            allowed=False,
            reason=f"robots.txt returned {status} — unreadable, so treating as disallow-all",
        )
    if 400 <= status < 500:
        return RobotsPolicy(allowed=True, reason=f"no robots.txt ({status}) — nothing disallowed")
    if 200 <= status < 300:
        return parse_robots(body, agent)
    return RobotsPolicy(allowed=False, reason=f"robots.txt returned an unexpected {status} — treating as disallow-all")


# --------------------------------------------------------------------------- #
# Transport                                                                    #
# --------------------------------------------------------------------------- #


@dataclass
class Response:
    status: int | None
    body: str
    error: str = ""


def curl_transport(url: str, agent: str, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> Response:
    """Fetches a URL with curl, returning the status even on an error status.

    Deliberately not `--fail`: a 403 or 429 is information we must report, and
    --fail throws the status away.
    """
    try:
        completed = subprocess.run(
            [
                "curl", "-sS", "-L",
                "--max-time", str(timeout),
                "--user-agent", agent,
                "--write-out", "\n%{http_code}",
                url,
            ],
            capture_output=True,
            timeout=timeout + 5,
        )
    except (subprocess.TimeoutExpired, OSError) as error:
        return Response(status=None, body="", error=str(error))

    if completed.returncode != 0:
        return Response(status=None, body="", error=completed.stderr.decode("utf-8", "replace").strip())

    text = completed.stdout.decode("utf-8", "replace")
    body, _, code = text.rpartition("\n")
    try:
        return Response(status=int(code.strip()), body=body)
    except ValueError:
        return Response(status=None, body="", error=f"could not read a status code from curl output: {code!r}")


class RateLimiter:
    """One request per second per host, at minimum."""

    def __init__(self, sleep=time.sleep, clock=time.monotonic) -> None:
        self._last: dict[str, float] = {}
        self._sleep = sleep
        self._clock = clock
        self.slept: list[tuple[str, float]] = []

    def wait(self, host: str, delay: float) -> float:
        interval = max(delay, MIN_INTERVAL_SECONDS)
        previous = self._last.get(host)
        now = self._clock()
        waited = 0.0
        if previous is not None:
            remaining = interval - (now - previous)
            if remaining > 0:
                self._sleep(remaining)
                waited = remaining
                now = self._clock()
        self._last[host] = now
        if waited:
            self.slept.append((host, waited))
        return waited


class FetchStopped(RuntimeError):
    """The host told us to stop. Report it; never retry it."""

    def __init__(self, url: str, status: int, message: str) -> None:
        super().__init__(message)
        self.url = url
        self.status = status


class FetchDisallowed(RuntimeError):
    """robots.txt did not permit this fetch, or could not be read."""


@dataclass
class FetchResult:
    url: str
    status: int
    body: str
    from_stored_copy: bool = False
    #: One line a caller can print verbatim so a reader knows the provenance.
    provenance: str = ""


class PolicyFetcher:
    """Fetches under the contract at the top of this file."""

    def __init__(
        self,
        script_name: str,
        transport=curl_transport,
        limiter: RateLimiter | None = None,
        timeout: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self.agent = user_agent(script_name)
        self.transport = transport
        self.limiter = limiter or RateLimiter()
        self.timeout = timeout
        self._robots: dict[str, RobotsPolicy] = {}
        self.log: list[str] = []

    def _robots_for(self, url: str) -> RobotsPolicy:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin in self._robots:
            return self._robots[origin]
        robots_url = urlunsplit((parts.scheme, parts.netloc, "/robots.txt", "", ""))
        self.limiter.wait(parts.netloc, MIN_INTERVAL_SECONDS)
        self.log.append(f"GET {robots_url}")
        response = self.transport(robots_url, self.agent, self.timeout)
        policy = robots_verdict(response.status, response.body, self.agent)
        self._robots[origin] = policy
        return policy

    def fetch(self, url: str) -> FetchResult:
        parts = urlsplit(url)
        policy = self._robots_for(url)
        if not policy.allowed:
            raise FetchDisallowed(f"{url}: {policy.reason}")
        if not policy.permits(parts.path or "/"):
            raise FetchDisallowed(f"{url}: robots.txt disallows this path for {self.agent}")

        self.limiter.wait(parts.netloc, policy.effective_delay())
        self.log.append(f"GET {url}")
        response = self.transport(url, self.agent, self.timeout)

        if response.status in STOP_STATUSES:
            raise FetchStopped(
                url,
                response.status,
                f"{url} returned {response.status} — stopping rather than retrying. "
                f"Wait and run again, or check whether this host wants automated access at all.",
            )
        if response.status is None:
            raise FetchDisallowed(f"{url}: transport failed: {response.error or 'unknown error'}")
        if response.status >= 400:
            raise FetchDisallowed(f"{url}: returned {response.status}")

        return FetchResult(
            url=url,
            status=response.status,
            body=response.body,
            from_stored_copy=False,
            provenance=f"Fetched live from {url} just now.",
        )


def stored_copy_result(url: str, body: str, retrieved_at: str) -> FetchResult:
    """Wraps a cached body so its provenance is stated, never implied."""
    return FetchResult(
        url=url,
        status=200,
        body=body,
        from_stored_copy=True,
        provenance=f"NOT live: served from a stored copy of {url} retrieved {retrieved_at}.",
    )


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #

USAGE = """fetch_policy.py — fetch a URL under this repository's fetching contract.

Usage: fetch_policy.py [--script NAME] URL

Prints the response body on stdout and a one-line provenance note on stderr, so
a shell script can capture the body with $(...) and still show the reader where
it came from. Shell scripts call this; Python scripts import PolicyFetcher.

Options:
  --script NAME  Name reported in the User-Agent (default: the caller's own
                 basename via $FETCH_POLICY_SCRIPT, else fetch_policy.py)
  -h, --help     Show this help and exit

Exit codes:
  0  success
  1  bad usage
  2  robots.txt disallowed the fetch, could not be read, or the fetch failed
  3  the host told us to stop (403, 429, 503) — wait, do not retry
"""


def _main(argv: list[str]) -> int:
    import os

    args = argv[1:]
    if not args or "-h" in args or "--help" in args:
        print(USAGE)
        return 0 if args else 1

    script_name = os.environ.get("FETCH_POLICY_SCRIPT", "fetch_policy.py")
    url = None
    index = 0
    while index < len(args):
        if args[index] == "--script":
            index += 1
            if index >= len(args):
                print("Error: --script needs a value. See --help.", file=sys.stderr)
                return 1
            script_name = args[index]
        elif args[index].startswith("-"):
            print(f'Error: unknown option "{args[index]}". See --help.', file=sys.stderr)
            return 1
        elif url is None:
            url = args[index]
        else:
            print("Error: expected exactly one URL. See --help.", file=sys.stderr)
            return 1
        index += 1

    if url is None:
        print("Error: no URL given. See --help.", file=sys.stderr)
        return 1

    fetcher = PolicyFetcher(script_name)
    try:
        result = fetcher.fetch(url)
    except FetchStopped as stopped:
        print(f"Error: {stopped}", file=sys.stderr)
        return 3
    except FetchDisallowed as disallowed:
        print(f"Error: {disallowed}", file=sys.stderr)
        return 2

    print(result.provenance, file=sys.stderr)
    sys.stdout.write(result.body)
    return 0


if __name__ == "__main__":
    import sys as _sys

    _sys.exit(_main(_sys.argv))
