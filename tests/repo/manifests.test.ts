/**
 * Invariants no single skill can see: whether the manifests that ship these
 * skills agree with the skills, and with each other.
 */
import { describe, expect, test } from "vitest";
import { loadSkill, readRepoJson, skillNames } from "@testkit/repo.ts";

interface PluginEntry {
  name: string;
  description: string;
  skills?: string[];
  license?: string;
}
interface Marketplace {
  plugins: PluginEntry[];
  metadata?: { version?: string };
}

/** Every manifest that declares plugins, and whether it lists skills per plugin. */
const MARKETPLACES = [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json", ".agents/plugins/marketplace.json"] as const;

/** The manifests that enumerate skill paths, and are therefore the install contract. */
const SKILL_LISTING_MARKETPLACES = [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json"] as const;

function pluginsOf(path: string): PluginEntry[] {
  return readRepoJson<Marketplace>(path).plugins;
}

function listedSkills(path: string): string[] {
  return pluginsOf(path)
    .flatMap((p) => p.skills ?? [])
    .map((s) => s.replace(/^\.\/skills\//, ""));
}

describe("marketplace coverage", () => {
  for (const manifest of SKILL_LISTING_MARKETPLACES) {
    test(`${manifest} lists every skill in skills/`, () => {
      const missing = skillNames().filter((n) => !listedSkills(manifest).includes(n));
      expect(
        missing,
        `${manifest}: skill(s) exist in skills/ but are in no plugin (${missing.join(", ")}) — they ship in the repo and install for nobody`,
      ).toEqual([]);
    });

    test(`${manifest} lists no skill that does not exist`, () => {
      const known = new Set(skillNames());
      const dangling = listedSkills(manifest).filter((n) => !known.has(n));
      expect(
        dangling,
        `${manifest}: lists skill(s) with no directory (${dangling.join(", ")}) — install resolves to nothing`,
      ).toEqual([]);
    });

    test(`${manifest} lists each skill exactly once`, () => {
      const seen = new Map<string, number>();
      for (const s of listedSkills(manifest)) seen.set(s, (seen.get(s) ?? 0) + 1);
      const duplicated = [...seen].filter(([, n]) => n > 1).map(([s]) => s);
      expect(duplicated, `${manifest}: skill(s) listed in more than one plugin (${duplicated.join(", ")})`).toEqual([]);
    });

    test(`${manifest} groups each skill with its own family`, () => {
      const wrong: string[] = [];
      for (const plugin of pluginsOf(manifest)) {
        for (const path of plugin.skills ?? []) {
          const name = path.replace(/^\.\/skills\//, "");
          if (!skillNames().includes(name)) continue;
          const family = loadSkill(name).family;
          const expected = plugin.name === "bootgs" ? "bootgs" : "apps-script";
          if (family !== expected) wrong.push(`${name} (${family}) is in plugin "${plugin.name}"`);
        }
      }
      expect(
        wrong,
        `${manifest}: skill(s) filed under the wrong plugin (${wrong.join("; ")}) — a user installing one family gets a skill scoped to the other`,
      ).toEqual([]);
    });
  }

  test("skills.sh.json groups every skill exactly once", () => {
    const grouped = readRepoJson<{ groupings: { skills: string[] }[] }>("skills.sh.json").groupings.flatMap((g) => g.skills);
    const missing = skillNames().filter((n) => !grouped.includes(n));
    const dangling = grouped.filter((n) => !skillNames().includes(n));
    expect(missing, `skills.sh.json: ungrouped skill(s) (${missing.join(", ")}) — they fall to the bottom of the published page unlabelled`).toEqual(
      [],
    );
    expect(dangling, `skills.sh.json: groups skill(s) that do not exist (${dangling.join(", ")})`).toEqual([]);
  });
});

describe("the manifests agree with each other", () => {
  test("every manifest declares the same set of plugins", () => {
    const sets = MARKETPLACES.map((m) => pluginsOf(m).map((p) => p.name).sort().join(","));
    expect(
      new Set(sets).size,
      `the manifests declare different plugin sets (${MARKETPLACES.map((m, i) => `${m}: [${sets[i]}]`).join("; ")}) — which one a consumer reads decides what they get`,
    ).toBe(1);
  });

  test("a plugin's description is the same wherever it is declared", () => {
    const byPlugin = new Map<string, { manifest: string; description: string }[]>();
    const record = (name: string, manifest: string, description: string) => {
      const bucket = byPlugin.get(name) ?? [];
      bucket.push({ manifest, description });
      byPlugin.set(name, bucket);
    };
    for (const manifest of MARKETPLACES) {
      for (const plugin of pluginsOf(manifest)) record(plugin.name, manifest, plugin.description);
    }
    // Gemini declares each plugin in its own extension manifest instead.
    for (const name of ["bootgs", "apps-script"]) {
      const manifest = `plugins/${name}/gemini-extension.json`;
      record(name, manifest, readRepoJson<{ description: string }>(manifest).description);
    }
    const divergent: string[] = [];
    for (const [name, entries] of byPlugin) {
      const distinct = new Set(entries.map((e) => e.description));
      if (distinct.size > 1) {
        divergent.push(`"${name}" differs across ${entries.map((e) => e.manifest).join(" vs ")}`);
      }
    }
    expect(
      divergent,
      `plugin description(s) have drifted between manifests (${divergent.join("; ")}) — each manifest is one storefront's copy, and the stale one advertises skills it no longer describes`,
    ).toEqual([]);
  });

  test("the root manifests agree on the version they publish", () => {
    const versions = {
      "package.json": readRepoJson<{ version: string }>("package.json").version,
      "plugin.json": readRepoJson<{ version: string }>("plugin.json").version,
      "gemini-extension.json": readRepoJson<{ version: string }>("gemini-extension.json").version,
    };
    expect(
      new Set(Object.values(versions)).size,
      `the root manifests disagree on the version (${JSON.stringify(versions)}) — they describe one artifact`,
    ).toBe(1);
  });
});
