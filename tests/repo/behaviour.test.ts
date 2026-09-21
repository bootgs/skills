/**
 * The behaviour layer costs money, so it is not run here. What is checked here
 * is everything about it that can be checked for free: that the committed case
 * tree still matches its source, and that the eval sets measure precision and
 * not only recall.
 */
import { describe, expect, test } from "vitest";
import { drift, loadEvalSets, type EvalCase } from "@testkit/gen-behaviour.ts";
import { loadSkill, skillNames } from "@testkit/repo.ts";

describe("the committed case tree", () => {
  test("has not drifted from tests/skills/*/evals.ts", async () => {
    const result = await drift();
    const complaints = [
      ...result.missing.map((p) => `missing  ${p}`),
      ...result.changed.map((p) => `changed  ${p}`),
      ...result.stale.map((p) => `stale    ${p}`),
    ];
    expect(
      complaints,
      `the generated behaviour tree no longer matches its source:\n  ${complaints.join("\n  ")}\n` +
        `The tree is committed so it can be reviewed in a diff; a tree that has drifted from the eval set is reviewed and then not run. Run \`npm run test:behaviour:gen\``,
    ).toEqual([]);
  });
});

describe("every skill is measured", () => {
  test("each skill authors an eval set", async () => {
    const authored = new Set((await loadEvalSets()).map((s) => s.skill));
    const missing = skillNames().filter((n) => !authored.has(n));
    expect(
      missing,
      `skill(s) with no tests/skills/<name>/evals.ts (${missing.join(", ")}) — nothing measures whether they change what the model does`,
    ).toEqual([]);
  });

  test("each skill with same-family siblings has a case that expects it to decline", async () => {
    const sets = await loadEvalSets();
    const withoutPrecision: string[] = [];
    for (const set of sets) {
      const family = loadSkill(set.skill).family;
      const hasSiblings = skillNames().some((n) => n !== set.skill && loadSkill(n).family === family);
      if (!hasSiblings) continue;
      const declines = set.cases.some((c: EvalCase) =>
        c.graders.some((g) => g.type === "tool_used" && g.tool === "Skill" && g.input_match === set.skill && g.max === 0),
      );
      if (!declines) withoutPrecision.push(set.skill);
    }
    expect(
      withoutPrecision,
      `eval set(s) with no case expecting the skill to decline in favour of a neighbour (${withoutPrecision.join(", ")}). ` +
        `Without one the suite measures recall only: a skill that fires on everything scores perfectly and is useless`,
    ).toEqual([]);
  });

  test("every `tool_used: Skill` grader is scoped to the with-plugin arm", async () => {
    const unscoped: string[] = [];
    for (const set of await loadEvalSets()) {
      for (const evalCase of set.cases) {
        for (const grader of evalCase.graders) {
          if (grader.type === "tool_used" && grader.tool === "Skill" && grader.arm !== "with-only") {
            unscoped.push(`${set.skill}/${evalCase.name}/${grader.name}`);
          }
        }
      }
    }
    expect(
      unscoped,
      `grader(s) checking that a Skill fired, scored in both arms (${unscoped.join(", ")}) — ` +
        `the baseline has no skill to fire, so it is marked down for the plugin's absence and Δ comes out flattering`,
    ).toEqual([]);
  });

  test("no case relies on a gated tool the runner is not told to allow", async () => {
    // `npm run test:behaviour` grants exactly these.
    const granted = new Set(["Bash", "WebFetch"]);
    const ungranted: string[] = [];
    for (const set of await loadEvalSets()) {
      for (const evalCase of set.cases) {
        for (const tool of evalCase.allowedTools ?? []) {
          if (/^(Bash|WebFetch|Write|Edit|mcp__)/.test(tool) && !granted.has(tool)) {
            ungranted.push(`${set.skill}/${evalCase.name}: ${tool}`);
          }
        }
      }
    }
    expect(
      ungranted,
      `case(s) list a gated tool that the behaviour script does not pass to --allow-tools (${ungranted.join(", ")}) — ` +
        `the run withholds it, the skill cannot do the thing it is being graded on, and the case fails for the wrong reason`,
    ).toEqual([]);
  });
});
