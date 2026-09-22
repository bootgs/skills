/**
 * The live layer: the same fetching rules, against the hosts this repository
 * actually talks to.
 *
 * Skipped unless `LIVE=1`, so `npm test` and CI never leave the machine.
 * Run it with `npm run test:live`.
 *
 * The fixture layer next door proves the rules bind over real HTTP, but every
 * response it grades is one this repository wrote. It cannot catch the failure
 * that actually happens: a vendor restructures a page and a shipped script
 * stops parsing it, or a value a skill documents stops existing. That is not
 * hypothetical — `Drive app` was documented here for months and Google calls it
 * `Google Drive app`, which was found by running a script by hand.
 *
 * These tests are slow on purpose. The fetching policy paces itself to one
 * request per second per host and reads `robots.txt` before each origin; that
 * is the behaviour under test, not overhead to work around.
 */
import { describe, expect, test } from "vitest";
import { bridge, runScript } from "@testkit/python.ts";
import { readRepoFile } from "@testkit/repo.ts";

const LIVE = process.env.LIVE === "1";
const TIMEOUT = 90_000;

interface FetchOutcome {
  outcome: "ok" | "stopped" | "disallowed";
  status?: number;
  body?: string;
  message?: string;
}

describe.skipIf(!LIVE)("robots.txt on the real hosts", () => {
  test(
    "developers.google.com permits the pages the skills fetch",
    async () => {
      const result = await bridge<FetchOutcome>("fetch", {
        url: "https://developers.google.com/apps-script/guides/services/quotas",
        script_name: "check-quotas.sh",
        timeout: 30,
      });
      expect(
        result.outcome,
        `Google's quotas page is no longer fetchable under our own policy (${result.message ?? ""}). ` +
          `Either robots.txt changed or the host is refusing us — check before assuming the scripts are broken`,
      ).toBe("ok");
      expect(result.body ?? "", "the page came back empty").not.toBe("");
    },
    TIMEOUT,
  );

  test(
    "registry.npmjs.org still serves something that imposes no rules",
    async () => {
      const result = await bridge<FetchOutcome>("fetch", {
        url: "https://registry.npmjs.org/bootgs/latest",
        script_name: "check-latest-version.sh",
        timeout: 30,
      });
      expect(
        result.outcome,
        `the npm registry is no longer fetchable under our own policy (${result.message ?? ""}). ` +
          `Note that /robots.txt there returns the npm package named "robots.txt", not a robots file; ` +
          `if npm ever serves a real one that disallows us, this is where it surfaces`,
      ).toBe("ok");
    },
    TIMEOUT,
  );
});

describe.skipIf(!LIVE)("the shipped scripts still work against their sources", () => {
  test(
    "check-quotas.sh returns the custom-function runtime row",
    async () => {
      const { code, stdout } = await runScript(
        "skills/apps-script-services/scripts/check-quotas.sh",
        ["Custom function"],
        { timeoutMs: TIMEOUT },
      );
      expect(code, "the script exited non-zero").toBe(0);
      expect(
        stdout,
        "the quotas page no longer yields a custom-function runtime row — the docs structure changed and the script's parser needs updating",
      ).toMatch(/Custom function runtime/i);
    },
    TIMEOUT,
  );

  test(
    "check-latest-version.sh resolves a semver for bootgs",
    async () => {
      const { code, stdout } = await runScript(
        "skills/bootgs-quickstart/scripts/check-latest-version.sh",
        ["bootgs"],
        { timeoutMs: TIMEOUT },
      );
      expect(code, "the script exited non-zero").toBe(0);
      expect(
        stdout,
        "no version came back from the npm registry — the response shape changed, or the package moved",
      ).toMatch(/latest:\s*\d+\.\d+\.\d+/);
    },
    TIMEOUT,
  );

  test(
    "every --integration value the skill documents still exists",
    async () => {
      const skill = readRepoFile("skills/apps-script-marketplace-publish/SKILL.md");
      const section = skill.split(/^## /m).find((s) => s.startsWith("Identify the integration type first"));
      expect(section, "the skill no longer has the section this test reads").toBeTruthy();

      const documented = [...section!.matchAll(/\|\s*`([^`]+)`\s*\|\s*$/gm)].map((m) => m[1].trim());
      expect(documented.length, "no --integration values could be parsed out of the skill's table").toBeGreaterThan(0);

      const { code, stdout } = await runScript(
        "skills/apps-script-marketplace-publish/scripts/fetch-review-requirements.py",
        ["--list-integrations"],
        { timeoutMs: TIMEOUT },
      );
      expect(code, "the script exited non-zero").toBe(0);
      const live = stdout.split("\n").map((l) => l.trim()).filter(Boolean);

      const missing = documented.filter((v) => !live.some((l) => l.toLowerCase() === v.toLowerCase()));
      expect(
        missing,
        `the skill documents --integration value(s) Google's page no longer offers (${missing.join(", ")}). ` +
          `Live values: ${live.join(", ")}. Following the skill as written would exit 3 and the audit would never run — ` +
          `this is the check that would have caught "Drive app"`,
      ).toEqual([]);
    },
    TIMEOUT,
  );
});
