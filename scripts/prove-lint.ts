#!/usr/bin/env node
/**
 * prove-lint.ts — breaks the tree on purpose, one mutation at a time, and
 * fails if the suite stays green.
 *
 * A green suite is only evidence if red is reachable. Every check here guards
 * something that has no other alarm — a licence that silently went missing, a
 * figure quoted with nothing behind it — so "it passes" has to be distinguished
 * from "it never looks".
 *
 *   node scripts/prove-lint.ts            run every mutation
 *   node scripts/prove-lint.ts <substr>   run the mutations whose name matches
 *
 * Each mutation is applied, the named test file is run, and the original bytes
 * are restored whether or not the run failed.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { repoRoot } from "./testkit/repo.ts";

const run = promisify(execFile);

interface Mutation {
  name: string;
  /** Repo-relative files this mutation edits. */
  files: string[];
  /** Test path passed to vitest. */
  target: string;
  apply(read: (f: string) => string, write: (f: string, s: string) => void): void;
}

const MUTATIONS: Mutation[] = [
  {
    name: "licence text edited",
    files: ["LICENSE"],
    target: "tests/repo/licensing.test.ts",
    apply: (read, write) =>
      write("LICENSE", read("LICENSE").replace("You must give any other recipients", "You may give any other recipients")),
  },
  {
    name: "package.json licence set to UNLICENSED",
    files: ["package.json"],
    target: "tests/repo/licensing.test.ts",
    apply: (read, write) => write("package.json", read("package.json").replace('"license": "Apache-2.0"', '"license": "UNLICENSED"')),
  },
  {
    name: "marketplace plugin entry loses its licence",
    files: [".claude-plugin/marketplace.json"],
    target: "tests/repo/licensing.test.ts",
    apply: (read, write) =>
      write(
        ".claude-plugin/marketplace.json",
        read(".claude-plugin/marketplace.json").replace(/\n\s*"license": "Apache-2\.0",/, ""),
      ),
  },
  {
    name: "a skill loses its licence",
    files: ["skills/bootgs-client/SKILL.md"],
    target: "tests/skills/bootgs-client",
    apply: (read, write) =>
      write("skills/bootgs-client/SKILL.md", read("skills/bootgs-client/SKILL.md").replace("\nlicense: Apache-2.0", "")),
  },
  {
    name: "vendored upstream copyright replaced",
    files: [".agents/skills/skill-creator/LICENSE.txt"],
    target: "tests/repo/licensing.test.ts",
    apply: (read, write) =>
      write(
        ".agents/skills/skill-creator/LICENSE.txt",
        read(".agents/skills/skill-creator/LICENSE.txt").replace(/Copyright \d{4} Anthropic, PBC\./, "Copyright 2026 Maksym Stoianov"),
      ),
  },
  {
    name: "third-party entry dropped",
    files: ["THIRD-PARTY.md"],
    target: "tests/repo/licensing.test.ts",
    apply: (read, write) =>
      write("THIRD-PARTY.md", read("THIRD-PARTY.md").replaceAll(".agents/skills/skill-creator", "some-other-path")),
  },
  {
    name: "vendored fetching policy drifts",
    files: ["skills/apps-script-services/scripts/fetch_policy.py"],
    target: "tests/repo/coverage.test.ts",
    apply: (read, write) =>
      write(
        "skills/apps-script-services/scripts/fetch_policy.py",
        read("skills/apps-script-services/scripts/fetch_policy.py").replace("MIN_INTERVAL_SECONDS = 1.0", "MIN_INTERVAL_SECONDS = 0.0"),
      ),
  },
  {
    name: "a script bypasses the fetching policy",
    files: ["skills/apps-script-services/scripts/check-quotas.sh"],
    target: "tests/repo/coverage.test.ts",
    apply: (read, write) =>
      write(
        "skills/apps-script-services/scripts/check-quotas.sh",
        read("skills/apps-script-services/scripts/check-quotas.sh").replace(
          /HTML=\$\(FETCH_POLICY_SCRIPT.*$/m,
          'HTML=$(curl -sL --fail "$URL")',
        ),
      ),
  },
  {
    name: "an unpinned figure is added",
    files: ["skills/apps-script-services/SKILL.md"],
    target: "tests/skills/apps-script-services",
    apply: (read, write) =>
      write(
        "skills/apps-script-services/SKILL.md",
        read("skills/apps-script-services/SKILL.md").replace(
          "## LockService: preventing concurrent-trigger races",
          "## LockService: preventing concurrent-trigger races\n\nA script may hold a lock for at most 47 minutes before it is released automatically.\n",
        ),
      ),
  },
  {
    name: "a figure's only pin is removed",
    files: ["skills/apps-script-services/SKILL.md"],
    target: "tests/skills/apps-script-services",
    apply: (read, write) => {
      const file = "skills/apps-script-services/SKILL.md";
      write(
        file,
        read(file)
          // Both the statement and the verification bullet cite the script;
          // unpinning means removing every citation, not just the first.
          .replace(/ Both are Google's[\s\S]*?return the current numbers\./, "")
          .replace(/ \(30 seconds at the time of writing — `scripts\/check-quotas\.sh "Custom function"` confirms it\)/, " (30 seconds)"),
      );
    },
  },
  {
    name: "a description loses its hand-off clause",
    files: ["skills/bootgs-openapi/SKILL.md"],
    target: "tests/skills/bootgs-openapi",
    apply: (read, write) =>
      write(
        "skills/bootgs-openapi/SKILL.md",
        read("skills/bootgs-openapi/SKILL.md").replace(/ Not for writing the client.*?\(`bootgs-quickstart`\)\./, ""),
      ),
  },
  {
    name: "a skill escapes the contract",
    files: ["tests/skills/bootgs-client/contract.test.ts"],
    target: "tests/repo/coverage.test.ts",
    apply: (read, write) =>
      write("tests/skills/bootgs-client/contract.test.ts", read("tests/skills/bootgs-client/contract.test.ts").replace("bootgs-client", "bootgs-openapi")),
  },
  {
    name: "the behaviour tree drifts from its source",
    files: ["tests/skills/bootgs-client/behaviour/defers-to-openapi/prompt.md"],
    target: "tests/repo/behaviour.test.ts",
    apply: (read, write) => {
      const file = "tests/skills/bootgs-client/behaviour/defers-to-openapi/prompt.md";
      write(file, read(file).replace("runs: 2", "runs: 9"));
    },
  },
  {
    name: "a Skill grader is scored in the baseline arm",
    files: ["tests/skills/bootgs-client/evals.ts"],
    target: "tests/repo/behaviour.test.ts",
    apply: (read, write) =>
      write(
        "tests/skills/bootgs-client/evals.ts",
        read("tests/skills/bootgs-client/evals.ts").replace('arm: "with-only"', 'arm: "both"'),
      ),
  },
];

async function vitestFails(target: string): Promise<boolean> {
  try {
    await run("npx", ["vitest", "run", target], { cwd: repoRoot, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });
    return false;
  } catch {
    return true;
  }
}

const filter = process.argv[2];
const selected = filter ? MUTATIONS.filter((m) => m.name.includes(filter)) : MUTATIONS;
const survivors: string[] = [];

for (const mutation of selected) {
  const originals = new Map(mutation.files.map((f) => [f, readFileSync(join(repoRoot, f), "utf8")]));
  const read = (f: string) => readFileSync(join(repoRoot, f), "utf8");
  const write = (f: string, s: string) => writeFileSync(join(repoRoot, f), s);

  let caught = false;
  try {
    mutation.apply(read, write);
    const unchanged = [...originals].every(([f, before]) => read(f) === before);
    if (unchanged) {
      survivors.push(`${mutation.name} (the mutation itself changed nothing — it no longer matches the file)`);
      continue;
    }
    caught = await vitestFails(mutation.target);
  } finally {
    for (const [file, content] of originals) write(file, content);
  }

  console.log(`${caught ? "caught " : "SURVIVED"}  ${mutation.name}`);
  if (!caught) survivors.push(mutation.name);
}

if (survivors.length > 0) {
  console.error(`\n${survivors.length} mutation(s) survived — those checks pass because they never look:`);
  for (const name of survivors) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(`\nAll ${selected.length} mutation(s) were caught.`);
