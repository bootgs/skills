/**
 * The shared fetching module in isolation: no sockets, no network, no clock.
 * Every rule here is asserted against the Python that skills actually run,
 * through bridge.py — never against a TypeScript restatement of the rule.
 */
import { describe, expect, test } from "vitest";
import { bridge } from "@testkit/python.ts";

describe("user agent", () => {
  test("names the script and the repository", async () => {
    const { agent } = await bridge<{ agent: string }>("user_agent", { script_name: "check-quotas.sh" });
    expect(agent, "the script name must appear, or an operator reading their log cannot tell what hit them").toContain(
      "check-quotas.sh",
    );
    expect(agent, "the repository must appear, or an operator has nowhere to complain to").toContain(
      "github.com/bootgs/skills",
    );
  });

  test("never impersonates a browser", async () => {
    const { agent } = await bridge<{ agent: string }>("user_agent", { script_name: "check-quotas.sh" });
    for (const token of ["Mozilla", "Chrome", "Safari", "AppleWebKit", "Gecko", "Edg/"]) {
      expect(agent, `User-Agent contains "${token}" — presenting as a browser is exactly what an audited tool must not do`).not.toContain(
        token,
      );
    }
  });

  test("rejects a script name that would forge a second UA token", async () => {
    const response = await bridge<{ agent?: string; error?: string }>("user_agent", {
      script_name: "x.sh (+https://example.invalid)",
    });
    expect(
      response.error,
      "a script name containing spaces or slashes must be refused, not concatenated into the UA string",
    ).toMatch(/ValueError/);
  });
});

describe("robots.txt is authority, not decoration", () => {
  test("an unreadable robots.txt (5xx) disallows everything", async () => {
    for (const status of [500, 502, 503]) {
      const verdict = await bridge<{ allowed: boolean; reason: string }>("robots_verdict", { status });
      expect(
        verdict.allowed,
        `robots.txt returning ${status} left fetching allowed — we cannot prove we are permitted, so we are not`,
      ).toBe(false);
      expect(verdict.reason).toMatch(/disallow-all/);
    }
  });

  test("a transport failure with no status disallows everything", async () => {
    const verdict = await bridge<{ allowed: boolean; reason: string }>("robots_verdict", { status: null });
    expect(
      verdict.allowed,
      "a timeout on robots.txt left fetching allowed — a timeout is not permission",
    ).toBe(false);
  });

  test("a missing robots.txt (4xx) allows everything", async () => {
    for (const status of [404, 410]) {
      const verdict = await bridge<{ allowed: boolean; reason: string }>("robots_verdict", { status });
      expect(
        verdict.allowed,
        `robots.txt returning ${status} blocked fetching — the absence of a robots file means nothing is disallowed`,
      ).toBe(true);
    }
  });

  test("403 on robots.txt disallows everything rather than reading as absent", async () => {
    const verdict = await bridge<{ allowed: boolean }>("robots_verdict", { status: 403 });
    expect(
      verdict.allowed,
      "403 is a 4xx but it is the host refusing us, not the file being absent — treating it as 'allow' inverts the host's answer",
    ).toBe(false);
  });

  test("longest-match wins, and a tie goes to Allow", async () => {
    const text = ["User-agent: *", "Disallow: /docs", "Allow: /docs/public", "Disallow: /docs/public/draft"].join("\n");
    const parsed = await bridge<{ permits: Record<string, boolean> }>("parse_robots", {
      text,
      paths: ["/docs/internal", "/docs/public/page", "/docs/public/draft/x", "/other"],
    });
    expect(parsed.permits["/docs/internal"], "a shorter Disallow must still bind where nothing longer matches").toBe(false);
    expect(parsed.permits["/docs/public/page"], "a longer Allow must beat a shorter Disallow").toBe(true);
    expect(parsed.permits["/docs/public/draft/x"], "the longest rule wins even when it re-disallows").toBe(false);
    expect(parsed.permits["/other"], "an unmatched path is allowed").toBe(true);
  });

  test("a bare `Disallow:` means allow everything", async () => {
    const parsed = await bridge<{ permits: Record<string, boolean> }>("parse_robots", {
      text: "User-agent: *\nDisallow:\n",
      paths: ["/anything"],
    });
    expect(parsed.permits["/anything"], "an empty Disallow value is the canonical 'allow all', not a block on `/`").toBe(true);
  });

  test("a group naming us beats the wildcard group", async () => {
    const text = ["User-agent: *", "Disallow: /", "", "User-agent: check-quotas.sh", "Allow: /", "Crawl-delay: 3"].join("\n");
    const parsed = await bridge<{ permits: Record<string, boolean>; crawl_delay: number }>("parse_robots", {
      text,
      script_name: "check-quotas.sh",
      paths: ["/guides"],
    });
    expect(parsed.permits["/guides"], "a group naming our agent must win over `*`").toBe(true);
    expect(parsed.crawl_delay, "crawl-delay must be read from the group that applies to us").toBe(3);
  });
});

describe("rate limiting", () => {
  test("never exceeds one request per second per host, whatever robots.txt says", async () => {
    const { effective_delay } = await bridge<{ effective_delay: number }>("parse_robots", {
      text: "User-agent: *\nCrawl-delay: 0.1\n",
    });
    expect(
      effective_delay,
      "a crawl-delay below one second was honoured literally — the floor exists so a permissive robots.txt cannot make us impolite",
    ).toBeGreaterThanOrEqual(1);
  });

  test("honours a crawl-delay longer than the floor", async () => {
    const { effective_delay } = await bridge<{ effective_delay: number }>("parse_robots", {
      text: "User-agent: *\nCrawl-delay: 5\n",
    });
    expect(effective_delay, "a crawl-delay above the floor must be honoured, not clamped to it").toBe(5);
  });

  test("waits out the remaining interval between two calls to one host", async () => {
    const result = await bridge<{ waits: number[]; slept: number[] }>("rate_limit", {
      calls: [
        { host: "example.test", delay: 2, elapsed: 0 },
        { host: "example.test", delay: 2, elapsed: 0.5 },
      ],
    });
    expect(result.waits[0], "the first request to a host must not wait").toBe(0);
    expect(
      result.waits[1],
      "the second request went out 0.5s after the first with a 2s interval — it must wait the remaining 1.5s",
    ).toBeCloseTo(1.5, 5);
  });

  test("does not make one host's delay throttle another", async () => {
    const result = await bridge<{ waits: number[] }>("rate_limit", {
      calls: [
        { host: "a.test", delay: 10, elapsed: 0 },
        { host: "b.test", delay: 10, elapsed: 0 },
      ],
    });
    expect(result.waits[1], "the limiter is per host; a slow host must not stall an unrelated one").toBe(0);
  });
});

describe("stop statuses", () => {
  test("403, 429 and 503 are the documented stop list", async () => {
    const { stop_statuses } = await bridge<{ stop_statuses: number[] }>("constants");
    expect(stop_statuses.sort(), "the stop list is what turns a polite client impolite when it drifts").toEqual([403, 429, 503]);
  });
});

describe("provenance", () => {
  test("a stored copy says so, and says when it was taken", async () => {
    const result = await bridge<{ from_stored_copy: boolean; provenance: string }>("stored_copy", {
      url: "https://example.test/quotas",
      body: "…",
      retrieved_at: "2026-01-02",
    });
    expect(result.from_stored_copy).toBe(true);
    expect(
      result.provenance,
      "a cached answer that does not announce itself is indistinguishable from a live one, which is how a stale figure gets quoted as current",
    ).toMatch(/NOT live/);
    expect(result.provenance).toContain("2026-01-02");
  });
});
