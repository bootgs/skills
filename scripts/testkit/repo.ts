/**
 * repo.ts — skill discovery, frontmatter parsing, family classification and
 * section extraction for the bootgs-skills test suite.
 *
 * The frontmatter parser here is deliberately INDEPENDENT of anything the
 * repository ships to its users (scripts/lint-licence.ts, any future linter).
 * A test that parses a skill with the same code the skill is validated by can
 * never catch that parser being wrong — it would agree with itself.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "..", "..");
export const skillsDir = join(repoRoot, "skills");

/** The single SPDX id every licence-bearing field in this repo must carry. */
export const SPDX_ID = "Apache-2.0";

/* ------------------------------------------------------------------ */
/* Frontmatter                                                         */
/* ------------------------------------------------------------------ */

export type YamlScalar = string | number | boolean | null;
export type YamlValue = YamlScalar | YamlScalar[] | Record<string, YamlScalar>;
export type Frontmatter = Record<string, YamlValue>;

export interface ParsedDocument {
  /** Parsed frontmatter, or null when the document has no `---` block at all. */
  frontmatter: Frontmatter | null;
  /** Everything after the closing `---`. */
  body: string;
  /** Structural complaints about the frontmatter block itself. */
  errors: string[];
  /** 1-based line number of each top-level key, for pointing at a failure. */
  keyLines: Record<string, number>;
}

function unquote(raw: string): YamlScalar {
  const value = raw.trim();
  if (value === "") return "";
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  return value;
}

const KEY_LINE = /^(?<indent>[ \t]*)(?<key>[A-Za-z_][A-Za-z0-9_-]*)[ \t]*:(?<rest>.*)$/;

/**
 * Parses a `---` delimited YAML frontmatter block supporting exactly the
 * subset an Agent Skill is allowed to use: top-level scalars, `- ` sequences,
 * and one level of nested two-space-indented mappings. Anything outside that
 * subset is reported as an error rather than silently coerced — a skill that
 * needs deeper YAML is itself the finding.
 */
export function parseFrontmatter(text: string): ParsedDocument {
  const errors: string[] = [];
  const keyLines: Record<string, number> = {};

  if (text.includes("\r\n")) errors.push("file uses CRLF line endings");

  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: null, body: text, errors: ["no frontmatter: first line is not `---`"], keyLines };
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { frontmatter: null, body: "", errors: ["frontmatter block is never closed by a `---` line"], keyLines };
  }

  const frontmatter: Frontmatter = {};
  let currentMapKey: string | null = null;
  let currentSeqKey: string | null = null;

  for (let i = 1; i < close; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    if (line.includes("\t")) errors.push(`line ${lineNo}: tab character in frontmatter (YAML forbids tabs for indentation)`);

    const seq = /^(?<indent>[ \t]*)-[ \t]+(?<item>.*)$/.exec(line);
    if (seq && currentSeqKey) {
      (frontmatter[currentSeqKey] as YamlScalar[]).push(unquote(seq.groups!.item));
      continue;
    }

    const match = KEY_LINE.exec(line);
    if (!match) {
      errors.push(`line ${lineNo}: not a \`key: value\` pair, a \`- item\`, or a comment: ${JSON.stringify(line)}`);
      continue;
    }

    const indent = match.groups!.indent.length;
    const key = match.groups!.key;
    const rest = match.groups!.rest;

    if (indent === 0) {
      currentSeqKey = null;
      if (key in frontmatter) errors.push(`line ${lineNo}: duplicate top-level key \`${key}\``);
      keyLines[key] = lineNo;
      if (rest.trim() === "") {
        // Either a nested mapping or a sequence; decided by the next content line.
        const next = lines.slice(i + 1, close).find((l) => l.trim() !== "");
        if (next !== undefined && /^[ \t]*-[ \t]/.test(next)) {
          frontmatter[key] = [];
          currentSeqKey = key;
          currentMapKey = null;
        } else {
          frontmatter[key] = {};
          currentMapKey = key;
        }
      } else {
        frontmatter[key] = unquote(rest);
        currentMapKey = null;
      }
      continue;
    }

    if (indent !== 2) {
      errors.push(`line ${lineNo}: indentation is ${indent} spaces; this parser accepts only top level and one 2-space level`);
      continue;
    }
    if (!currentMapKey) {
      errors.push(`line ${lineNo}: indented key \`${key}\` has no parent mapping`);
      continue;
    }
    (frontmatter[currentMapKey] as Record<string, YamlScalar>)[key] = unquote(rest);
  }

  return { frontmatter, body: lines.slice(close + 1).join("\n"), errors, keyLines };
}

/* ------------------------------------------------------------------ */
/* Markdown structure                                                  */
/* ------------------------------------------------------------------ */

export interface Section {
  /** Heading text with the leading `## ` removed. */
  heading: string;
  /** Section body, excluding the heading line. */
  content: string;
  /** 1-based line number of the heading within the body. */
  line: number;
}

/**
 * Splits a body into its `## ` sections.
 *
 * Deliberately NOT a `/^## (.+)$([\s\S]*?)(?=^## |$)/m` regex: under the `m`
 * flag `$` matches at the first newline, so the lookahead is satisfied
 * immediately and every section comes back empty. Splitting is unambiguous.
 */
export function splitSections(body: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  let fenced = false;

  lines.forEach((line, index) => {
    if (/^\s{0,3}(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), content: "", line: index + 1 };
      sections.push(current);
      return;
    }
    if (current) current.content += line + "\n";
  });

  return sections;
}

/** Replaces fenced code blocks with blank lines, preserving line numbering. */
export function stripFencedCode(text: string): string {
  let fenced = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s{0,3}(```|~~~)/.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

/** Replaces `inline code` spans with spaces, preserving length. */
export function stripInlineCode(text: string): string {
  return text.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

export interface Link {
  text: string;
  target: string;
}

export function extractLinks(text: string): Link[] {
  return [...text.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => ({
    text: m[1],
    target: m[2],
  }));
}

/** Bare `https://...` URLs, whether or not they sit inside a markdown link. */
export function extractUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s)<>"'`\]]+/g)].map((m) => m[0].replace(/[.,;:]+$/, ""));
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

/**
 * A skill's family. Families differ in what the contract demands of them:
 * `bootgs` skills document a framework this repository owns and must say so;
 * `apps-script` skills document Google's platform and must say where they
 * stop and a sibling begins.
 */
export type Family = "bootgs" | "apps-script";

export interface Skill extends ParsedDocument {
  name: string;
  dir: string;
  /** Path to SKILL.md, relative to the repository root. */
  file: string;
  raw: string;
  frontmatter: Frontmatter;
  family: Family;
  sections: Section[];
  /** Bundled files under scripts/ assets/ references/, repo-relative. */
  bundled: string[];
  /** Shipped executables under scripts/. */
  scripts: string[];
  metadata: Record<string, YamlScalar>;
}

export function skillNames(): string[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(skillsDir, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();
}

/**
 * Build artefacts that appear beside a skill's files the moment someone runs
 * one of its scripts. They are git-ignored, so treating them as shipped files
 * would fail the contract for anyone who has actually used the skill.
 */
const NOT_SHIPPED = new Set([".DS_Store", "__pycache__", ".pytest_cache", ".ruff_cache"]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (NOT_SHIPPED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && !entry.name.endsWith(".pyc")) out.push(full);
  }
  return out;
}

export function classifyFamily(name: string, frontmatter: Frontmatter | null): Family {
  const metadata = (frontmatter?.metadata ?? {}) as Record<string, YamlScalar>;
  if (metadata.framework === "bootgs" || name.startsWith("bootgs-")) return "bootgs";
  return "apps-script";
}

const skillCache = new Map<string, Skill>();

export function loadSkill(name: string): Skill {
  const cached = skillCache.get(name);
  if (cached) return cached;

  const dir = join(skillsDir, name);
  const file = join(dir, "SKILL.md");
  const raw = readFileSync(file, "utf8");
  const parsed = parseFrontmatter(raw);
  const frontmatter = parsed.frontmatter ?? {};

  const bundled = ["scripts", "assets", "references"].flatMap((sub) =>
    walk(join(dir, sub)).map((f) => relative(repoRoot, f)),
  );

  const skill: Skill = {
    ...parsed,
    frontmatter,
    name,
    dir,
    file: relative(repoRoot, file),
    raw,
    family: classifyFamily(name, parsed.frontmatter),
    sections: splitSections(parsed.body),
    bundled,
    scripts: bundled.filter((f) => f.includes("/scripts/")),
    metadata: (frontmatter.metadata ?? {}) as Record<string, YamlScalar>,
  };

  skillCache.set(name, skill);
  return skill;
}

export function allSkills(): Skill[] {
  return skillNames().map(loadSkill);
}

export function isExecutable(repoRelativePath: string): boolean {
  return (statSync(join(repoRoot, repoRelativePath)).mode & 0o111) !== 0;
}

export function readRepoFile(repoRelativePath: string): string {
  return readFileSync(join(repoRoot, repoRelativePath), "utf8");
}

export function readRepoJson<T = unknown>(repoRelativePath: string): T {
  return JSON.parse(readRepoFile(repoRelativePath)) as T;
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

/**
 * A quantity a skill states as fact, which a model may quote back at a user
 * as if it were current. Extraction is mechanical; whether a figure is
 * adequately accounted for is a policy decision and lives in suite.ts.
 */
export interface Figure {
  /** The figure as written, e.g. `9 KB`, `>=22.14.0`. */
  text: string;
  /** Lower-cased, whitespace-collapsed, for comparing against a declaration. */
  key: string;
  /** Heading of the section it was stated in. */
  section: string;
  /** The whole line it was stated on. */
  line: string;
}

const UNITS =
  "KB|MB|GB|TB|kB|bytes?|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|ms|milliseconds?|characters?|chars?|rows?|columns?|cells?|requests?|calls?|triggers?|emails?|recipients?";

const UNIT_FIGURE = new RegExp(String.raw`(?<![\w.])(\d[\d,_]*(?:\.\d+)?)\s*\*{0,2}(${UNITS})\b`, "gi");

/**
 * Version-like figures only count when they carry a comparator or an explicit
 * `v`/`version` marker. Bare `3.0` is almost always part of a proper noun
 * ("OpenAPI 3.0", "HTTP 1.1") rather than a claim about a moving target.
 */
const VERSION_FIGURE = /(?<![\w.])(?:>=|<=|>|<|\^|~)\s?v?\d+\.\d+(?:\.\d+)?(?![\d.])/g;

/** Hedges that mark a number as a rule of thumb, not a figure to be quoted. */
const HEDGE = /(?:~|\babout\b|\broughly\b|\bapproximately\b|\bcirca\b|\border of\b)[\s\d.,–—-]*$/i;

export function extractFigures(skill: Skill): Figure[] {
  const figures: Figure[] = [];

  for (const section of skill.sections) {
    const prose = stripInlineCode(stripFencedCode(section.content));
    for (const line of prose.split("\n")) {
      if (line.trim() === "") continue;
      const seen = new Set<string>();

      const push = (raw: string, start: number) => {
        if (HEDGE.test(line.slice(Math.max(0, start - 24), start))) return;
        const text = raw.replace(/\*/g, "").replace(/\s+/g, " ").trim();
        const key = text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        figures.push({ text, key, section: section.heading, line: line.trim() });
      };

      for (const m of line.matchAll(UNIT_FIGURE)) push(m[0], m.index!);
      for (const m of line.matchAll(VERSION_FIGURE)) push(m[0], m.index!);
    }
  }

  return figures;
}

/** Distinct figures, keyed by `key`, keeping every site each one appears at. */
export function groupFigures(figures: Figure[]): Map<string, Figure[]> {
  const grouped = new Map<string, Figure[]>();
  for (const figure of figures) {
    const bucket = grouped.get(figure.key);
    if (bucket) bucket.push(figure);
    else grouped.set(figure.key, [figure]);
  }
  return grouped;
}
