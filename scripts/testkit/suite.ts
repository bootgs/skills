/**
 * suite.ts — the shared, family-aware contract every skill is held to.
 *
 * One thin file per skill under tests/skills/<name>/ calls describeSkill();
 * everything a skill must satisfy lives here exactly once. Every threshold is
 * in LIMITS so tuning the contract never means grepping for a magic number.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test as vitestTest } from "vitest";

import {
  SPDX_ID,
  type Family,
  type Figure,
  type Section,
  type Skill,
  extractFigures,
  extractUrls,
  groupFigures,
  isExecutable,
  loadSkill,
  readRepoFile,
  repoRoot,
  skillNames,
  stripFencedCode,
} from "./repo.ts";

/** Every tunable the contract uses. Change a number here, nowhere else. */
export const LIMITS = {
  /** Anthropic's hard cap on an Agent Skill description. */
  descriptionMaxChars: 1024,
  /** Below this a description cannot carry both a scope and a trigger. */
  descriptionMinChars: 120,
  /** A SKILL.md past this is a reference doc; move detail to references/. */
  bodyMaxLines: 500,
  /** A section this short is a stub, not guidance. */
  sectionMinChars: 40,
  /** Skill directory names must be kebab-case and fit a plugin manifest. */
  nameMaxChars: 64,
  /** Deeper than this and the document has become a manual. */
  maxHeadingDepth: 3,
} as const;

/**
 * Phrases that declare a figure unpinnable. A stated exception is auditable;
 * silence is indistinguishable from an oversight, which is the whole point of
 * requiring one of these rather than inferring intent.
 */
export const UNPINNABLE_MARKERS = [
  "change without notice",
  "changes without notice",
  "without notice",
  "don't trust a number",
  "as of this writing",
  "verify against",
  "unpinnable",
] as const;

/**
 * A description states a trigger when it says "use" followed by a *condition*.
 * Not just `when`: "Use before anything goes public" and "Use after a release"
 * are triggers too, and rejecting them fires on correct content. `Use for ...`
 * is deliberately excluded — that introduces a topic, which is a summary.
 */
export const TRIGGER_CLAUSE =
  /\buse (?:this skill )?(?:when|before|after|whenever|while|if|during|any ?time)\b/i;

/** A reference to a script that re-derives a figure from the live source. */
const LIVE_CHECK = /\b(?:scripts\/)?[\w.-]*(?:check|fetch)-[\w.-]+\.(?:sh|py|ts)\b/;

export interface SkillContext {
  skill: Skill;
  test: typeof vitestTest;
  expect: typeof expect;
  /** The section whose heading starts with `prefix`, or undefined. */
  section(prefix: string): Section | undefined;
  /** Body with fenced code blocks blanked out. */
  prose(): string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function siblings(skill: Skill): string[] {
  return skillNames().filter((n) => n !== skill.name && familyOf(n) === skill.family);
}

function familyOf(name: string): Family {
  return loadSkill(name).family;
}

function verificationSection(skill: Skill): Section | undefined {
  return skill.sections.find((s) => /^verification\b/i.test(s.heading));
}

/** Does this section itself account for a figure it states? */
function sectionAccounts(section: Section): boolean {
  const text = section.content;
  if (extractUrls(text).some((u) => u.startsWith("https://"))) return true;
  if (LIVE_CHECK.test(text)) return true;
  return UNPINNABLE_MARKERS.some((marker) => text.toLowerCase().includes(marker));
}

/**
 * A figure may also be accounted for away from where it is stated, provided
 * the accounting line names the figure literally — so the exception travels
 * with the number rather than covering a whole file by implication.
 */
function namedElsewhere(skill: Skill, figure: Figure): boolean {
  const prose = stripFencedCode(skill.body);
  for (const line of prose.split("\n")) {
    const lower = line.toLowerCase();
    if (!lower.includes(figure.key) && !lower.includes(figure.key.replace(/\s+/g, ""))) continue;
    if (extractUrls(line).some((u) => u.startsWith("https://"))) return true;
    if (LIVE_CHECK.test(line)) return true;
    if (UNPINNABLE_MARKERS.some((marker) => lower.includes(marker))) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* The contract                                                        */
/* ------------------------------------------------------------------ */

export function describeSkill(name: string, extra?: (ctx: SkillContext) => void): void {
  const skill = loadSkill(name);
  const context: SkillContext = {
    skill,
    test: vitestTest,
    expect,
    section: (prefix) => skill.sections.find((s) => s.heading.toLowerCase().startsWith(prefix.toLowerCase())),
    prose: () => stripFencedCode(skill.body),
  };

  describe(`skill: ${name} [${skill.family}]`, () => {
    /* ---------------- frontmatter ---------------- */

    describe("frontmatter", () => {
      vitestTest("parses as the YAML subset a skill is allowed to use", () => {
        expect(
          skill.errors,
          `${skill.file}: frontmatter is malformed, so every loader reads a different skill than the author wrote`,
        ).toEqual([]);
      });

      vitestTest("`name` matches the directory it is loaded from", () => {
        expect(
          skill.frontmatter.name,
          `${skill.file}: frontmatter name is "${skill.frontmatter.name}" but the directory is "${name}" — installers key on the directory and would surface the wrong name`,
        ).toBe(name);
      });

      vitestTest("`name` is kebab-case and fits a plugin manifest", () => {
        expect(name, `skills/${name}: not kebab-case — plugin manifests and skill ids assume [a-z0-9-]`).toMatch(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        );
        expect(
          name.length,
          `skills/${name}: name is ${name.length} chars, over the ${LIMITS.nameMaxChars}-char budget`,
        ).toBeLessThanOrEqual(LIMITS.nameMaxChars);
      });

      vitestTest("`license` carries the repository's SPDX id", () => {
        expect(
          skill.frontmatter.license,
          `${skill.file}: license is ${JSON.stringify(skill.frontmatter.license)}, not "${SPDX_ID}" — a skill copied out of this repo would carry no licence`,
        ).toBe(SPDX_ID);
      });

      vitestTest("declares an author and a semver version", () => {
        expect(skill.metadata.author, `${skill.file}: metadata.author is missing — nothing attributes the skill`).toBeTruthy();
        expect(
          String(skill.metadata.version ?? ""),
          `${skill.file}: metadata.version is ${JSON.stringify(skill.metadata.version)}, not semver — consumers cannot tell an update from a rewrite`,
        ).toMatch(/^\d+\.\d+\.\d+$/);
      });

      vitestTest("declares `compatibility` when it ships scripts a user must run", () => {
        if (skill.scripts.length === 0) return;
        expect(
          skill.frontmatter.compatibility,
          `${skill.file}: ships ${skill.scripts.length} script(s) but declares no \`compatibility:\` — a user learns the missing interpreter from a stack trace`,
        ).toBeTruthy();
      });
    });

    /* ---------------- description is a trigger ---------------- */

    describe("description", () => {
      const description = String(skill.frontmatter.description ?? "");

      vitestTest("is present and within the length budget", () => {
        expect(description.length, `${skill.file}: description is missing or a stub`).toBeGreaterThanOrEqual(
          LIMITS.descriptionMinChars,
        );
        expect(
          description.length,
          `${skill.file}: description is ${description.length} chars, over the ${LIMITS.descriptionMaxChars}-char cap — it will be truncated before the model ever reads the trigger`,
        ).toBeLessThanOrEqual(LIMITS.descriptionMaxChars);
      });

      vitestTest("states when to fire, not just what it covers", () => {
        expect(
          description,
          `${skill.file}: description has no "Use when ..." clause — a summary tells the model what the skill is about but never that this request is the one`,
        ).toMatch(TRIGGER_CLAUSE);
      });

      vitestTest("hands off to a same-group sibling by name", () => {
        const group = siblings(skill);
        if (group.length === 0) return;
        const named = group.filter((s) => description.includes(s));
        expect(
          named,
          `${skill.file}: description names none of its ${group.length} same-family siblings (${group.join(", ")}). ` +
            `Without a hand-off clause the eval set can only measure recall — the skill fires on a neighbour's request and nothing says it was wrong`,
        ).not.toEqual([]);
      });

      if (skill.family === "bootgs") {
        vitestTest("names the framework it is scoped to", () => {
          expect(
            skill.metadata.framework,
            `${skill.file}: a bootgs-family skill must carry metadata.framework: bootgs so a consumer can filter the family`,
          ).toBe("bootgs");
          expect(
            description.toLowerCase(),
            `${skill.file}: a bootgs skill whose description never says "bootgs" will fire on plain Apps Script questions`,
          ).toContain("bootgs");
        });
      } else {
        vitestTest("states that it is framework-agnostic", () => {
          expect(
            description,
            `${skill.file}: an apps-script-family skill that does not say it is framework-agnostic reads as bootgs-only and will be skipped by users who need it`,
          ).toMatch(/framework-agnostic|with or without bootgs|independent of any framework/i);
        });
      }
    });

    /* ---------------- document structure ---------------- */

    describe("structure", () => {
      vitestTest("opens with exactly one H1", () => {
        const h1s = skill.body.split("\n").filter((l) => /^# \S/.test(l));
        expect(h1s.length, `${skill.file}: expected exactly one H1, found ${h1s.length} — renderers key the skill title off it`).toBe(1);
      });

      vitestTest("has no heading deeper than the contract allows", () => {
        const deep = stripFencedCode(skill.body)
          .split("\n")
          .filter((l) => /^#{4,} /.test(l));
        expect(
          deep,
          `${skill.file}: heading(s) deeper than h${LIMITS.maxHeadingDepth} — that depth of nesting belongs in references/, not in the file the model loads every time`,
        ).toEqual([]);
      });

      vitestTest("ends with a verification section", () => {
        expect(
          verificationSection(skill),
          `${skill.file}: no "## Verification" section — nothing tells the model how to know it applied the skill correctly. Sections present: ${skill.sections.map((s) => s.heading).join(", ")}`,
        ).toBeTruthy();
      });

      vitestTest("has no empty or stub section", () => {
        const stubs = skill.sections
          .filter((s) => s.content.trim().length < LIMITS.sectionMinChars)
          .map((s) => s.heading);
        expect(
          stubs,
          `${skill.file}: section(s) under ${LIMITS.sectionMinChars} chars — a heading with nothing under it costs context and teaches nothing`,
        ).toEqual([]);
      });

      vitestTest("stays inside the line budget", () => {
        const lines = skill.raw.split("\n").length;
        expect(
          lines,
          `${skill.file}: ${lines} lines, over the ${LIMITS.bodyMaxLines}-line budget — SKILL.md is loaded in full on every trigger, so detail past this belongs in references/`,
        ).toBeLessThanOrEqual(LIMITS.bodyMaxLines);
      });
    });

    /* ---------------- bundled files ---------------- */

    describe("bundled files", () => {
      vitestTest("every shipped file is announced in the body", () => {
        const unmentioned = skill.bundled
          .map((f) => f.slice(`skills/${name}/`.length))
          .filter((rel) => !skill.body.includes(rel));
        expect(
          unmentioned,
          `${skill.file}: ships file(s) the body never mentions (${unmentioned.join(", ")}) — a file the model is never told about is dead weight in the bundle`,
        ).toEqual([]);
      });

      vitestTest("every path the body points at exists", () => {
        const referenced = [...skill.body.matchAll(/`([^`\n]*(?:scripts|assets|references)\/[\w.-]+(?:\/[\w.-]+)*)`/g)]
          .map((m) => m[1].split(/\s+/).pop()!)
          .filter((p) => !p.startsWith("http"));
        const missing = [
          ...new Set(
            referenced.filter((p) => {
              const cleaned = p.replace(/^\.\//, "");
              if (cleaned.startsWith("../")) {
                return !existsSync(join(skill.dir, cleaned));
              }
              return !existsSync(join(skill.dir, cleaned)) && !existsSync(join(repoRoot, cleaned));
            }),
          ),
        ];
        expect(
          missing,
          `${skill.file}: points at path(s) that do not exist (${missing.join(", ")}) — the model runs the command and gets "No such file or directory"`,
        ).toEqual([]);
      });

      vitestTest("every shipped script with a shebang is executable", () => {
        const broken = skill.scripts.filter((f) => readRepoFile(f).startsWith("#!") && !isExecutable(f));
        expect(
          broken,
          `${skill.file}: script(s) declare an interpreter but are not chmod +x (${broken.join(", ")}) — the documented invocation fails with "permission denied"`,
        ).toEqual([]);
      });

      vitestTest("every shipped script answers --help", () => {
        const silent = skill.scripts.filter((f) => !/--help/.test(readRepoFile(f)));
        expect(
          silent,
          `${silent.join(", ")}: shipped script has no --help, but the skill tells the model to run one for options`,
        ).toEqual([]);
      });
    });

    /* ---------------- cross-references ---------------- */

    describe("cross-references", () => {
      vitestTest("every skill-shaped reference resolves to a skill that exists", () => {
        const known = new Set(skillNames());
        const referenced = [...skill.raw.matchAll(/`((?:bootgs|apps-script)-[a-z0-9-]+)`/g)].map((m) => m[1]);
        const dangling = [...new Set(referenced.filter((r) => !known.has(r)))];
        expect(
          dangling,
          `${skill.file}: refers to skill(s) that do not exist (${dangling.join(", ")}) — a rename left a pointer into nothing`,
        ).toEqual([]);
      });

      vitestTest("never links over plain http", () => {
        const insecure = extractUrls(skill.raw).filter((u) => u.startsWith("http://"));
        expect(insecure, `${skill.file}: plain-http link(s) (${insecure.join(", ")})`).toEqual([]);
      });

      vitestTest("leaks no local path or session URL", () => {
        const leaks = [
          ...skill.raw.matchAll(/(?:\/Users\/[\w.-]+|file:\/\/\/[^\s`)]+|https:\/\/claude\.ai\/[^\s`)]+)/g),
        ].map((m) => m[0]);
        expect(
          leaks,
          `${skill.file}: contains a machine-local path or a session URL (${leaks.join(", ")}) — neither resolves for anyone else and a session URL is not shareable`,
        ).toEqual([]);
      });
    });

    /* ---------------- figures ---------------- */

    describe("figures", () => {
      vitestTest("every stated figure is pinned or declared unpinnable", () => {
        const grouped = groupFigures(extractFigures(skill));
        const unaccounted: string[] = [];

        for (const [key, sites] of grouped) {
          const bySection = new Map(skill.sections.map((s) => [s.heading, s]));
          const pinnedInPlace = sites.some((site) => {
            const section = bySection.get(site.section);
            return section ? sectionAccounts(section) : false;
          });
          if (pinnedInPlace || namedElsewhere(skill, sites[0])) continue;
          unaccounted.push(`"${sites[0].text}" (## ${sites[0].section}) — ${sites[0].line.slice(0, 90)}`);
        }

        expect(
          unaccounted,
          `${skill.file}: figure(s) stated as fact with no citation, no live-check script and no unpinnable declaration:\n  ${unaccounted.join("\n  ")}\n` +
            `A figure with none of the three is quoted back to a user as current with nothing behind it. Pin it to a source, point at the script that re-derives it, or say in the same section that it moves and where to look.`,
        ).toEqual([]);
      });
    });

    if (extra) extra(context);
  });
}
