# Defects the suite found

Seven defects, each reproducible from a named failing test. File these as issues
and close each from the commit that fixes it (`Closes #N` on its own line,
before the attribution trailers).

---

## 1. No skill description hands off to a same-family sibling

**Found by** `tests/skills/*/contract.test.ts` → *description › hands off to a same-group sibling by name* (11 of 11 skills)

Every skill has same-family siblings and not one description named one. Each
description said what the skill covers and when to fire, but never where it
stops. Without a hand-off clause the eval set can only measure recall: a skill
that fires on a neighbour's request scores perfectly and nothing says it was
wrong.

**Fix:** a hand-off clause on all 11 descriptions naming the sibling that owns
the adjacent request. Longest result is 686 chars, well inside the 1024 cap.

---

## 2. Two Google execution limits stated as fact with nothing behind them

**Found by** `tests/skills/apps-script-services/contract.test.ts` → *figures › every stated figure is pinned or declared unpinnable*

`skills/apps-script-services/SKILL.md` stated **30 seconds** (custom function
runtime) and **6 minutes** (script runtime) in bold, with no citation, no
live-check reference and no unpinnable declaration. The skill's own
"Checking current quotas" section declares 9 KB / 500 KB / 6 hours unpinnable
but never names these two.

Both figures are **correct** — verified against
`https://developers.google.com/apps-script/guides/services/quotas`, which
returns `Custom function runtime 30 sec / execution` and
`Script runtime 6 min / execution`. They were unpinned, not wrong.

**Fix:** point both at `scripts/check-quotas.sh "Custom function"` and
`scripts/check-quotas.sh "runtime"`, which already cover them.

---

## 3. The documented `--integration` value does not exist

**Found by** running the shipped script against the live source, not by a test.

`skills/apps-script-marketplace-publish/SKILL.md` documented `Drive app` as an
`--integration` value. Google's page calls it **`Google Drive app`**:

```
$ python3 scripts/fetch-review-requirements.py --integration "Drive app"
No integration named "Drive app". Available: Google Chat app, Google Drive app,
Editor add-on, Google Workspace add-on, Web app          # exit 3
```

Following the skill as written fails the audit for a Drive integration.

**Fix:** correct the table, and say that `--list-integrations` is the authority
if the table has drifted.

---

## 4. Four scripts fetch with no identification and no robots.txt

**Found by** `tests/repo/coverage.test.ts` → *the vendored fetching policy has not drifted › every skill that fetches over the network vendors the policy*

`check-quotas.sh`, `fetch-review-requirements.py` and both copies of
`check-latest-version.sh` called `curl` directly: no User-Agent naming the
script or repository, `robots.txt` never read, no pacing, and `--fail` threw
away the status so a 403/429/503 was indistinguishable from any other failure.

**Fix:** `template/scripts/fetch_policy.py`, vendored into each fetching skill
by `npm run sync:fetch-policy`. Proven in isolation by `tests/template/unit/`
(16 tests) and over real HTTP by `tests/template/integration/` (14 tests).

Worth recording: `https://registry.npmjs.org/robots.txt` returns **200 with the
npm package named `robots.txt`**, not a robots file. The parser finds no
directive and imposes no rules, which is what RFC 9309 prescribes, and says so
in its reason rather than reporting a successful parse of nothing.

---

## 5. No plugin entry in any marketplace manifest carries a licence

**Found by** `tests/repo/licensing.test.ts` → *the SPDX id is stated everywhere a consumer looks › every plugin entry in …* (3 manifests, 2 entries each)

`.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json` and
`.agents/plugins/marketplace.json` had no `license` on any plugin entry. The
marketplace entry is what a consumer reads at install time — the worst place for
the licence to be absent. The three per-plugin Gemini extension manifests were
missing it too.

**Fix:** `"license": "Apache-2.0"` on every plugin entry and every Gemini
manifest, plus a test covering each.

---

## 6. Vendored third-party content was undeclared

**Found by** `tests/repo/licensing.test.ts` → *third-party content is declared › THIRD-PARTY.md exists*

`.agents/skills/skill-creator/` is vendored from `anthropics/skills` (recorded
in `skills-lock.json`) and ships its own `LICENSE.txt` with Anthropic's
copyright. Nothing told a consumer any of this.

**Fix:** `THIRD-PARTY.md`. Upstream ships no `NOTICE`, so there is none to
propagate — the `LICENSE.txt` beside the skill is the whole notice. Its terms
hash to the canonical Apache-2.0 text, and a test fails if that copyright line
is ever replaced.

---

## 7. Plugin descriptions had drifted between manifests

**Found by** `tests/repo/manifests.test.ts` → *the manifests agree with each other › a plugin's description is the same wherever it is declared*

`.agents/plugins/marketplace.json` and both `plugins/*/gemini-extension.json`
carried stale copies: the `bootgs` description omitted "layered architecture
enforcement" and the `apps-script` one omitted "UI (menus/sidebars/dialogs)",
though both plugins ship those skills. Each manifest is one storefront's copy,
and the stale one advertises skills it no longer describes.

**Fix:** sync all copies to the `.claude-plugin` wording, and extend the
invariant to the Gemini manifests.

---

## Not fixed — needs your call

`package.json` still has `"private": true` while declaring `homepage`,
`repository` and `bugs` pointing at a public GitHub repo. Removing it is what
you want if you intend to `npm publish`; keeping it is right if the repo is
public but the package is not meant for the registry. No test asserts either
way, because only you know the intent.
