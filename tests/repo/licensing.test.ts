/**
 * The licence sweep. This repository is public and single-licensed: one SPDX
 * id, stated everywhere a consumer might look, with anything belonging to
 * someone else declared separately.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SPDX_ID, allSkills, readRepoFile, readRepoJson, repoRoot } from "@testkit/repo.ts";

/**
 * SHA-256 of the Apache-2.0 "Apache License … END OF TERMS AND CONDITIONS"
 * block with trailing whitespace stripped, taken from
 * https://www.apache.org/licenses/LICENSE-2.0.txt.
 *
 * The appendix and the copyright line are deliberately outside the hash: every
 * correct deployment of this licence edits those. Everything before them is
 * the licence, and a single edited word there makes it a different licence
 * that merely looks like Apache-2.0.
 */
const APACHE_TERMS_SHA256 = "59899c6091b540582ed617e8eeaac4919dc985ccfc35459ee9752b699be5205b";

function termsHash(text: string): string | null {
  const start = text.indexOf("                                 Apache License");
  const marker = "END OF TERMS AND CONDITIONS";
  const end = text.indexOf(marker);
  if (start === -1 || end === -1) return null;
  const block = text
    .slice(start, end + marker.length)
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n");
  return createHash("sha256").update(block).digest("hex");
}

interface PluginEntry {
  name: string;
  license?: string;
}

const MARKETPLACES = [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json", ".agents/plugins/marketplace.json"] as const;

/** Gemini declares each plugin in its own extension manifest rather than a marketplace entry. */
const GEMINI_MANIFESTS = [
  "gemini-extension.json",
  "plugins/bootgs/gemini-extension.json",
  "plugins/apps-script/gemini-extension.json",
] as const;

describe("LICENSE", () => {
  test("exists at the repository root", () => {
    expect(existsSync(join(repoRoot, "LICENSE")), "no LICENSE at the root — a public repo with no licence file is not open source").toBe(
      true,
    );
  });

  test("its terms are verbatim Apache-2.0", () => {
    expect(
      termsHash(readRepoFile("LICENSE")),
      "LICENSE's terms do not hash to the canonical Apache-2.0 text — an edited licence is a bespoke licence nobody's tooling recognises",
    ).toBe(APACHE_TERMS_SHA256);
  });

  test("its copyright line is filled in", () => {
    const text = readRepoFile("LICENSE");
    expect(text, "LICENSE still carries the template placeholders — nobody is asserting copyright").not.toMatch(
      /\[yyyy\]|\[name of copyright owner\]/,
    );
    expect(text, "LICENSE has no Copyright line").toMatch(/Copyright \d{4}/);
  });
});

describe("the SPDX id is stated everywhere a consumer looks", () => {
  test("package.json", () => {
    const license = readRepoJson<{ license?: string }>("package.json").license;
    expect(license, `package.json: license is ${JSON.stringify(license)}, not "${SPDX_ID}"`).toBe(SPDX_ID);
    expect(
      license,
      'package.json: "UNLICENSED" is npm\'s own convention, not an SPDX id, and the similar-looking "Unlicense" is a public-domain dedication meaning the opposite',
    ).not.toBe("UNLICENSED");
  });

  test("plugin.json", () => {
    expect(readRepoJson<{ license?: string }>("plugin.json").license).toBe(SPDX_ID);
  });

  test("every SKILL.md", () => {
    const wrong = allSkills()
      .filter((s) => s.frontmatter.license !== SPDX_ID)
      .map((s) => `${s.file}: ${JSON.stringify(s.frontmatter.license)}`);
    expect(wrong, `SKILL.md frontmatter licence(s) wrong or missing (${wrong.join(", ")})`).toEqual([]);
  });

  for (const manifest of GEMINI_MANIFESTS) {
    test(manifest, () => {
      const license = readRepoJson<{ license?: string }>(manifest).license;
      expect(license, `${manifest}: license is ${JSON.stringify(license)}, not "${SPDX_ID}"`).toBe(SPDX_ID);
    });
  }

  for (const manifest of MARKETPLACES) {
    test(`every plugin entry in ${manifest}`, () => {
      const entries = readRepoJson<{ plugins: PluginEntry[] }>(manifest).plugins;
      const wrong = entries.filter((p) => p.license !== SPDX_ID).map((p) => `${p.name}: ${JSON.stringify(p.license)}`);
      expect(
        wrong,
        `${manifest}: plugin entr(ies) with no or wrong licence (${wrong.join(", ")}). ` +
          `The marketplace entry is what a consumer reads at install time — it is the worst place for the licence to be absent`,
      ).toEqual([]);
    });
  }
});

describe("third-party content is declared", () => {
  test("THIRD-PARTY.md exists", () => {
    expect(
      existsSync(join(repoRoot, "THIRD-PARTY.md")),
      "no THIRD-PARTY.md — this repository vendors content it did not write, and nothing tells a consumer whose it is",
    ).toBe(true);
  });

  test("every vendored LICENSE file is accounted for in THIRD-PARTY.md", () => {
    if (!existsSync(join(repoRoot, "THIRD-PARTY.md"))) return;
    const notice = readRepoFile("THIRD-PARTY.md");
    // Anything the repo vendors ships its own licence file next to it.
    const vendored = [".agents/skills/skill-creator"];
    const undeclared = vendored.filter((path) => !notice.includes(path));
    expect(
      undeclared,
      `THIRD-PARTY.md does not mention vendored path(s) (${undeclared.join(", ")}) — redistributing someone else's Apache-2.0 work requires retaining their notice`,
    ).toEqual([]);
  });

  test("every vendored Apache-2.0 licence is retained verbatim", () => {
    const vendoredLicence = ".agents/skills/skill-creator/LICENSE.txt";
    if (!existsSync(join(repoRoot, vendoredLicence))) return;
    expect(
      termsHash(readRepoFile(vendoredLicence)),
      `${vendoredLicence}: the upstream licence text has been altered — retaining it verbatim is the condition of redistributing the work`,
    ).toBe(APACHE_TERMS_SHA256);
    expect(
      readRepoFile(vendoredLicence),
      `${vendoredLicence}: upstream's copyright line has been replaced — that is exactly the notice that must be retained`,
    ).toMatch(/Copyright \d{4} Anthropic/);
  });
});
