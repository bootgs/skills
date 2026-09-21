#!/usr/bin/env node
/**
 * sync-fetch-policy.ts — copies template/scripts/fetch_policy.py into every
 * skill whose scripts reference it.
 *
 * A skill has to work when installed on its own, so it cannot import a file
 * from the repository root. Vendoring keeps it self-contained; this script
 * plus tests/repo/coverage.test.ts keep the copies from drifting apart.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { chmodSync, copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { repoRoot, skillNames } from "./testkit/repo.ts";

const source = join(repoRoot, "template", "scripts", "fetch_policy.py");
let copied = 0;

for (const name of skillNames()) {
  const scriptsDir = join(repoRoot, "skills", name, "scripts");
  if (!existsSync(scriptsDir)) continue;

  const referencesPolicy = readdirSync(scriptsDir, { withFileTypes: true }).some(
    (entry) =>
      entry.isFile() &&
      entry.name !== "fetch_policy.py" &&
      readFileSync(join(scriptsDir, entry.name), "utf8").includes("fetch_policy"),
  );
  if (!referencesPolicy) continue;

  const target = join(scriptsDir, "fetch_policy.py");
  copyFileSync(source, target);
  chmodSync(target, 0o755);
  copied++;
  console.log(`  skills/${name}/scripts/fetch_policy.py`);
}

console.log(`Synced fetch_policy.py into ${copied} skill(s).`);
