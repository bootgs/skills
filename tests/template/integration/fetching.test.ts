/**
 * The fetching rules, bound over real HTTP.
 *
 * Every request here leaves the process through curl and arrives at a loopback
 * server that records it. The unit layer proves the rules are written down;
 * this layer proves they are reached.
 */
import { afterEach, describe, expect, test } from "vitest";
import { bridge } from "@testkit/python.ts";
import { ok, startFixture, status, type Fixture } from "@testkit/httpfix.ts";

let fixture: Fixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

const ALLOW_ALL = "User-agent: *\nDisallow:\n";

interface FetchOutcome {
  outcome: "ok" | "stopped" | "disallowed";
  status?: number;
  body?: string;
  message?: string;
  provenance?: string;
  from_stored_copy?: boolean;
  log?: string[];
}

async function fetchThrough(target: string, scriptName = "check-quotas.sh"): Promise<FetchOutcome> {
  return bridge<FetchOutcome>("fetch", { url: target, script_name: scriptName, timeout: 5 });
}

describe("robots.txt is read before the target", () => {
  test("robots.txt is requested first, and the target only after", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/quotas": ok("QUOTA TABLE") });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(result.outcome, `expected a successful fetch, got: ${result.message ?? ""}`).toBe("ok");
    expect(
      fixture.requests.map((r) => r.path),
      "the target was fetched without robots.txt being read first — the check is not wired into the path a skill actually takes",
    ).toEqual(["/robots.txt", "/quotas"]);
    expect(result.body).toBe("QUOTA TABLE");
  });

  test("a disallowed path is never requested at all", async () => {
    fixture = await startFixture({
      "/robots.txt": ok("User-agent: *\nDisallow: /quotas\n"),
      "/quotas": ok("QUOTA TABLE"),
    });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(result.outcome, "a path robots.txt disallows must not be fetched").toBe("disallowed");
    expect(
      fixture.hits("/quotas"),
      "the disallowed path was still requested — deciding after the request is not obeying robots.txt",
    ).toEqual([]);
  });

  test("an unreadable robots.txt (503) blocks the target", async () => {
    fixture = await startFixture({ "/robots.txt": status(503), "/quotas": ok("QUOTA TABLE") });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(result.outcome, "a 503 on robots.txt must block, not fall through to allow").toBe("disallowed");
    expect(result.message).toMatch(/disallow-all/);
    expect(fixture.hits("/quotas"), "the target was fetched despite robots.txt being unreadable").toEqual([]);
  });

  test("a missing robots.txt (404) allows the target", async () => {
    fixture = await startFixture({ "/quotas": ok("QUOTA TABLE") });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(
      result.outcome,
      `a host with no robots.txt must be fetchable; got ${result.outcome}: ${result.message ?? ""}`,
    ).toBe("ok");
    expect(fixture.hits("/robots.txt").length, "robots.txt must still have been attempted").toBe(1);
  });

  test("robots.txt is fetched once per host, not once per request", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/a": ok("A"), "/b": ok("B") });

    await bridge("fetch", { url: `${fixture.url}/a`, script_name: "check-quotas.sh", timeout: 5 });
    await bridge("fetch", { url: `${fixture.url}/b`, script_name: "check-quotas.sh", timeout: 5 });

    // Two separate processes, so one robots fetch each; within one process it
    // must be cached. Assert the per-process behaviour explicitly.
    const single = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/a": ok("A") });
    await bridge("fetch", { url: `${single.url}/a`, script_name: "check-quotas.sh", timeout: 5 });
    expect(single.hits("/robots.txt").length, "robots.txt must be fetched exactly once for the origin").toBe(1);
    await single.close();
  });
});

describe("the User-Agent that actually goes over the wire", () => {
  test("names the script and repository, and is not a browser", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/quotas": ok("QUOTA TABLE") });

    await fetchThrough(`${fixture.url}/quotas`, "fetch-review-requirements.py");

    const agents = [...new Set(fixture.requests.map((r) => r.userAgent))];
    expect(agents.length, "every request from one run must carry the same UA").toBe(1);
    expect(
      agents[0],
      "the UA on the wire does not name the script — what the module builds and what curl sends have diverged",
    ).toContain("fetch-review-requirements.py");
    expect(agents[0]).toContain("github.com/bootgs/skills");
    expect(agents[0], "curl's default UA leaked through instead of ours").not.toMatch(/^curl\//);
    expect(agents[0]).not.toMatch(/Mozilla|Chrome|Safari/);
  });

  test("robots.txt is requested under the same UA the rules are matched against", async () => {
    fixture = await startFixture({
      "/robots.txt": ok("User-agent: *\nDisallow: /\n\nUser-agent: check-quotas.sh\nDisallow:\n"),
      "/quotas": ok("QUOTA TABLE"),
    });

    const result = await fetchThrough(`${fixture.url}/quotas`, "check-quotas.sh");

    expect(
      result.outcome,
      "the group naming our agent was not applied — asking as one identity and matching rules as another is how a crawler ends up breaking a rule it read",
    ).toBe("ok");
    expect(fixture.hits("/robots.txt")[0].userAgent).toContain("check-quotas.sh");
  });
});

describe("the host's no is final", () => {
  for (const code of [403, 429, 503]) {
    test(`${code} stops and reports, and does not retry`, async () => {
      fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/quotas": status(code, "go away") });

      const result = await fetchThrough(`${fixture.url}/quotas`);

      expect(result.outcome, `${code} must stop the run`).toBe("stopped");
      expect(result.status).toBe(code);
      expect(
        result.message,
        "the stop message must say what happened and what to do, since it is what the user sees instead of an answer",
      ).toMatch(new RegExp(`${code}`));
      expect(
        fixture.hits("/quotas").length,
        `the target was requested ${fixture.hits("/quotas").length} times after a ${code} — retrying a refusal is how a tool gets blocked outright`,
      ).toBe(1);
    });
  }

  test("a 404 on the target is reported, not silently treated as an empty page", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL) });

    const result = await fetchThrough(`${fixture.url}/gone`);

    expect(result.outcome, "a 404 must not come back as a successful empty body").not.toBe("ok");
    expect(result.message).toMatch(/404/);
  });
});

describe("pacing", () => {
  test("two requests to one host are at least a second apart", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/quotas": ok("QUOTA TABLE") });

    const started = Date.now();
    const result = await fetchThrough(`${fixture.url}/quotas`);
    const elapsed = Date.now() - started;

    expect(result.outcome).toBe("ok");
    const [robots, target] = fixture.requests;
    expect(
      target.at - robots.at,
      `robots.txt and the target arrived ${target.at - robots.at}ms apart — the one-request-per-second floor is not being applied between them`,
    ).toBeGreaterThanOrEqual(900);
    expect(elapsed, "the run should not take absurdly longer than the interval it is waiting out").toBeLessThan(15_000);
  });

  test("a crawl-delay longer than the floor is honoured on the wire", async () => {
    fixture = await startFixture({
      "/robots.txt": ok("User-agent: *\nDisallow:\nCrawl-delay: 2\n"),
      "/quotas": ok("QUOTA TABLE"),
    });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(result.outcome).toBe("ok");
    const [robots, target] = fixture.requests;
    expect(
      target.at - robots.at,
      `a Crawl-delay of 2s was not honoured: the gap was ${target.at - robots.at}ms`,
    ).toBeGreaterThanOrEqual(1900);
  });
});

describe("provenance", () => {
  test("a live answer states that it is live", async () => {
    fixture = await startFixture({ "/robots.txt": ok(ALLOW_ALL), "/quotas": ok("QUOTA TABLE") });

    const result = await fetchThrough(`${fixture.url}/quotas`);

    expect(result.from_stored_copy, "a live fetch must not be reported as cached").toBe(false);
    expect(
      result.provenance,
      "a result with no provenance line lets a caller print a figure without saying where it came from",
    ).toMatch(/Fetched live/);
  });
});
