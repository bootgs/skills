/**
 * Whether the suite still covers what the repository ships. A test layer that
 * silently stops covering a new skill is worse than no layer, because the
 * green run is read as evidence.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readRepoFile, repoRoot, skillNames } from "@testkit/repo.ts";

const testsSkillsDir = join(repoRoot, "tests", "skills");

describe("every skill is under contract", () => {
  test("each skill has a test directory with a contract file", () => {
    const missing = skillNames().filter((n) => !existsSync(join(testsSkillsDir, n, "contract.test.ts")));
    expect(
      missing,
      `skill(s) with no tests/skills/<name>/contract.test.ts (${missing.join(", ")}) — a new skill would ship unchecked and the suite would still be green`,
    ).toEqual([]);
  });

  test("each contract file names the skill its directory is for", () => {
    const wrong: string[] = [];
    for (const name of skillNames()) {
      const file = join("tests", "skills", name, "contract.test.ts");
      if (!existsSync(join(repoRoot, file))) continue;
      if (!readRepoFile(file).includes(`describeSkill("${name}"`)) wrong.push(file);
    }
    expect(
      wrong,
      `contract file(s) that do not call describeSkill for their own directory (${wrong.join(", ")}) — a copy-paste leaves one skill tested twice and another not at all`,
    ).toEqual([]);
  });

  test("no test directory outlives the skill it tested", () => {
    if (!existsSync(testsSkillsDir)) return;
    const known = new Set(skillNames());
    const orphans = readdirSync(testsSkillsDir, { withFileTypes: true })
      // `claude plugin eval` writes its run output to <eval dir>/results/.
      .filter((e) => e.isDirectory() && e.name !== "results" && !known.has(e.name))
      .map((e) => e.name);
    expect(orphans, `tests/skills/: directories for skills that no longer exist (${orphans.join(", ")})`).toEqual([]);
  });
});

describe("the vendored fetching policy has not drifted", () => {
  const canonical = "template/scripts/fetch_policy.py";

  test("every vendored copy is byte-identical to the template", () => {
    const expected = readRepoFile(canonical);
    const drifted: string[] = [];
    for (const name of skillNames()) {
      const copy = join("skills", name, "scripts", "fetch_policy.py");
      if (!existsSync(join(repoRoot, copy))) continue;
      if (readRepoFile(copy) !== expected) drifted.push(copy);
    }
    expect(
      drifted,
      `vendored fetching policy has drifted from ${canonical} (${drifted.join(", ")}) — a skill would fetch under rules the test suite never checked. Re-run \`npm run sync:fetch-policy\``,
    ).toEqual([]);
  });

  test("every skill that fetches over the network vendors the policy", () => {
    const offenders: string[] = [];
    for (const name of skillNames()) {
      const scriptsDir = join(repoRoot, "skills", name, "scripts");
      if (!existsSync(scriptsDir)) continue;
      for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
        // __pycache__/ and any other directory is not a script.
        if (!entry.isFile() || entry.name === "fetch_policy.py") continue;
        const source = readRepoFile(join("skills", name, "scripts", entry.name));
        const fetches = /\bcurl\b|urllib|requests\.|https?:\/\//.test(source);
        // Must actually invoke the policy. A header comment saying it does is
        // exactly what a bypass leaves behind, so mentioning it is not enough.
        const usesPolicy =
          /python3?\s+"?\$?\{?\w*\}?\/?fetch_policy\.py/.test(source) ||
          /^\s*(?:from\s+fetch_policy\s+import|import\s+fetch_policy)/m.test(source);
        if (fetches && !usesPolicy) offenders.push(`skills/${name}/scripts/${entry.name}`);
      }
    }
    expect(
      offenders,
      `script(s) reach the network without going through the shared fetching policy (${offenders.join(", ")}) — ` +
        `they send no identifying User-Agent, never read robots.txt, and retry a 429. Every rule the unit and integration layers prove is bypassed`,
    ).toEqual([]);
  });
});

describe("nothing a skill fetched is in version control", () => {
  test("the corpus directory is git-ignored except for its README", () => {
    const ignore = readRepoFile(".gitignore");
    expect(
      ignore,
      ".gitignore does not ignore corpus/ — fetched pages would be committed, which turns a cache into a redistribution of someone else's content",
    ).toMatch(/^corpus\/\*?$/m);
    expect(ignore, ".gitignore must keep corpus/README.md tracked so the directory explains itself").toMatch(
      /^!corpus\/README\.md$/m,
    );
  });

  test("git tracks nothing inside corpus/ but the README", () => {
    const tracked = execFileSync("git", ["ls-files", "corpus"], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    expect(
      tracked.filter((f) => f !== "corpus/README.md"),
      `fetched content is committed (${tracked.join(", ")}) — git-ignoring it after the fact does not remove it from history`,
    ).toEqual([]);
  });
});
