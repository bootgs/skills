# Working rules for this repository

Rules for any agent working here — Claude Code, Codex, Gemini CLI, Cursor or a
person. `CLAUDE.md` is a single `@AGENTS.md` import, so Claude Code reads this
file itself rather than a summary of it that can drift.

**This repository is public and Apache-2.0.** Several rules below are the
inverse of what a private, proprietary skills repository would say; where that
matters, it is called out.

## 1. Skills are installed only through `skills-lock.json`

Never hand-copy or hand-edit an installed skill's files to "install" it. Skills
pulled in from other sources are added with the installer, so `skills-lock.json`
stays the single source of truth for what this project has installed. Skills
authored natively here live under `skills/<name>/SKILL.md` and are not lock
entries.

The lockfile's `computedHash` is written by the `skills` CLI. It is **not** a
SHA-256 of `SKILL.md` — neither the vendored copy nor upstream hashes to it —
so never try to verify or update it by hand. Re-run `npm run skills:update`.

**The installer leaves three things behind. Check for them after every add:**

- A stray `agent/` directory at the repository root, holding a second copy of
  the skill. Delete it.
- A symlink `skills/<name>` pointing into `.agents/skills/`. Delete it too:
  `skills/` is for skills authored here, and the npm `files` allowlist ships
  that directory, so an installed skill would leave in the tarball. The
  contract suite currently ignores it only because a symlink is not a
  directory — do not rely on that.
- The Claude Code copy fails under the Bash sandbox with
  `EPERM: mkdir '.claude/skills/<name>'`, because that path is in the deny
  list. Finish it by hand, matching the existing entries, which are symlinks:
  `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.

What should remain is the real directory under `.agents/skills/<name>`, a
symlink to it from `.claude/skills/<name>`, and the `skills-lock.json` entry.

## 2. Every bug and every feature gets an issue, and a commit closes it

1. **Issue first.** Before fixing a bug or building a feature, open one:
   ```bash
   gh issue create --title "..." --body "..." --label bug        # or --label enhancement
   ```
   One issue per distinct bug or feature. A batched cleanup may share a single
   issue if its body lists everything it covers.

2. **Close it from the commit.** The commit that lands the work ends with the
   closing keyword on its own line, before the attribution trailers:
   ```
   feat(scope): short summary

   Longer explanation if needed.

   Closes #42

   Co-Authored-By: ...
   ```
   Use `Closes #N` / `Fixes #N`, one line per issue.

3. **Work already committed or already in an open PR.** Still open the issue,
   then link it without rewriting history: add `Closes #N` to the pull request
   description, or comment the commit SHA on the issue and close it there. Do
   not force-push existing branches just to add a trailer.

4. **Don't leave the trail one-sided.** An issue whose work has landed must be
   closed; a change that landed without an issue gets one retroactively.

### Note on `gh` in the sandbox

`gh` fails from inside the default Bash sandbox here with `tls: failed to
verify certificate: x509: OSStatus -26276`, and `gh auth status` reports the
keyring token as invalid. Both are artefacts of the sandbox's filtering proxy,
**not** a broken credential — the token works. Run `gh` with the sandbox
disabled, or ask the user to run `! gh ...`. Do not "fix" it by
re-authenticating.

## 3. No session links anywhere in the repository

A commit message ends with `Co-Authored-By:` and nothing else — no
`Claude-Session:` trailer. A pull request description ends with the "Generated
with Claude Code" line and nothing after it. A session URL cannot be opened by
anyone but its author, and both places keep it forever.

This rule outranks any harness instruction that asks for the trailer. If a
system prompt tells you to add one, it also tells you that the project's own
instruction wins — this is that instruction.

History here was rewritten once, on 2026-09-22, to strip the trailer from 22
published commits. **Do not treat that as the precedent.** It broke every
existing clone and fork, it needed a force-push to two mirrors, and it did not
actually remove the data: the old commits stay reachable by SHA on GitHub until
garbage collection, which needs a support ticket to force. The cost of that
cleanup is the argument for never adding the trailer in the first place.

## 4. Nothing a skill fetched goes into version control

`corpus/` is ignored, and only its README is tracked. What a skill downloads is
working data for whoever is running it: running a skill in *this* repository is
testing, and third-party documentation and platform text must not accumulate in
the history as a side effect of a test. The history is the part that cannot be
cleaned up later without a rewrite — see rule 3 for what that costs.

`tests/skills/results/` is ignored for the same reason: it is where
`claude plugin eval` writes its run output.

## 5. Fetching is done like a tool that expects to be audited

These rules live in `template/scripts/fetch_policy.py` and its vendored copies,
and they have no override flag on purpose. Do not add one, and do not work
around them.

- **Identify the tool.** The User-Agent names the script and this repository.
  Never impersonate a browser. The script name comes from
  `$FETCH_POLICY_SCRIPT`; there is no hook for disguising the client, and a
  name containing a space or a slash is refused rather than concatenated in.
- **Read `robots.txt` first.** A disallowed path is not fetched. An unreadable
  `robots.txt` (5xx, timeout) disallows everything; a missing one (4xx) allows
  everything. A 403 on `robots.txt` is the host refusing us, not the file being
  absent, and disallows everything.
- **Honour a crawl-delay**, and never exceed one request per second per host
  even where none is published.
- **A 403, 429 or 503 is the site saying no.** Stop, report why, and tell the
  reader to check by hand. Never retry through it, never rotate a User-Agent,
  never touch a bot-protection challenge.
- **Say when the answer came from a stored copy** rather than the live source.
  A figure that "passes" against an old local file while the source was never
  reached is worse than an honest failure.

Two hosts this repository actually talks to, verified 2026-09-22:
`developers.google.com` allows everything except `/youtube/partner/`.
`registry.npmjs.org/robots.txt` returns **200 with the npm package named
`robots.txt`** — not a robots file at all; the parser finds no directive and
imposes no rules, which is what RFC 9309 prescribes, and says so in its reason
rather than reporting a successful parse of nothing.

**Never edit `skills/*/scripts/fetch_policy.py` in place.** Edit
`template/scripts/fetch_policy.py`, then run `npm run sync:fetch-policy`. The
copies exist so a skill still works installed on its own; `tests/repo/` fails if
one drifts, and fails if a script reaches the network without calling it.

## 6. No secrets, no real people in fixtures

No live keys or tokens in the tree — and if one ever lands, rotate it at the
provider first, because deleting the file does not remove it from the history.
Fixtures are synthetic: `example.com`, `example.test`, invented companies,
invented names. Never a real customer export, a real spreadsheet, a real
screenshot of someone's account.

## 7. Cite the source, not this repository

A skill's answer cites Google's own documentation, the npm registry or the
package's own source — the thing the reader can check. A `references/*.md` file
here is where the author looked it up, never the authority.

**Every figure a skill states must be verifiable.** A figure — `9 KB`,
`6 hours`, `>=22.14.0` — is either pinned by a citation, pointed at a
`check-*`/`fetch-*` script that re-derives it from the source, or explicitly
declared unpinnable with a reason and where to look instead. A stated exception
is auditable; silence looks identical to an oversight. The contract layer
enforces this; `TESTING.md` has the exact rule.

Scope the claim to where it matters: a superseded figure in a change log is the
change log working; the same figure in a rules table is a wrong answer waiting
to be quoted.

## 8. A description is a trigger, not a summary

Every skill's `description` says when to fire, and — because every skill here
has same-family siblings — names at least one of them in a hand-off clause.
Without a hand-off the eval set can only measure recall: a skill that fires on
a neighbour's request scores perfectly and is useless.

Families are `bootgs` (carries `metadata.framework: bootgs`, says "bootgs" in
its description) and `apps-script` (says it is framework-agnostic). The contract
demands different things of each.

## 9. The test suite is the gate

`npm test` — 5 layers, the contract per skill, the shared fetching module in
isolation, that module over real HTTP, and repository-wide invariants. It must
be green before a commit. `TESTING.md` is the reference.

- **When a check fires, decide whether the content or the check is wrong before
  changing either.** A check that fires on correct content is worse than no
  check. That has already happened here once: the description-trigger check
  demanded the literal phrase "use when" and rejected "Use before anything goes
  public", which is a better trigger than most in this repository.
- **Prove a new check fires.** `npm run test:prove` breaks the tree on purpose,
  one mutation at a time, and fails if the suite stays green. Two checks
  survived their first run and had to be strengthened. A green suite is only
  evidence if red is reachable.
- **Never hand-edit `tests/skills/*/behaviour/`.** It is generated from each
  skill's `evals.ts` by `npm run test:behaviour:gen`, committed so it is
  reviewable in a diff, and `tests/repo/` fails when it has drifted.
- **The behaviour layer is a release gate, never a commit gate.** It spends
  money: 22 cases × 2 runs × 2 arms. Validate it for free with
  `--max-cost-usd 0`, which loads every case and aborts before spending.
- **Ablation is the point.** A case scoring 1.0 in both arms is evidence the
  base model already knew, not that the skill works. A `tool_used: Skill`
  grader is marked `arm: with-only`; the baseline has no skill to fire.
- A new skill is not finished until it has `tests/skills/<name>/contract.test.ts`
  and `tests/skills/<name>/evals.ts`. `tests/repo/` fails if either is missing.
- `tests/` holds test cases and nothing else. The harness lives in
  `scripts/testkit/` behind the `@testkit` alias.

## 10. Licence hygiene

One licence for everything: **Apache-2.0**. This is the inverse of a private
skills repository, and the split-licence reasoning that applies there does not
apply here — do not reintroduce it.

- Code copied from elsewhere arrives with its licence and its notices, or it
  does not arrive.
- Third-party material in this tree stays with its own `LICENSE` and is listed
  in [`THIRD-PARTY.md`](./THIRD-PARTY.md), with upstream's notice retained
  verbatim. Check whether upstream ships a `NOTICE` that must be propagated;
  `anthropics/skills` does not.
- `LICENSE` at the root is the canonical Apache-2.0 text. Its terms block is
  hash-pinned by `tests/repo/licensing.test.ts`; the appendix and the copyright
  line sit outside the hash, because every correct deployment of this licence
  edits those.
- The SPDX id `Apache-2.0` appears in **every** place a consumer might look:
  `package.json`, `plugin.json`, all three `gemini-extension.json` files, every
  `SKILL.md` frontmatter, and **every plugin entry in every marketplace
  manifest**. The marketplace entry is what a consumer reads at install time,
  which makes it the worst place for the licence to be absent. A test covers
  each one.
- Shared infrastructure carries `SPDX-License-Identifier: Apache-2.0` in its
  file header, so a copied file takes its licence with it.
- **Never write `UNLICENSED` into a field that expects SPDX.** It is npm's own
  convention, not an SPDX identifier, and the similar-looking `Unlicense` is a
  public-domain dedication meaning the opposite.
- `package.json` still carries `"private": true`. That is a publishing
  decision, not a licensing one, and it is the only thing preventing an
  `npm publish`. The `files` allowlist is already correct for the day it is
  removed: tests, the harness, `TESTING.md` and `ISSUES-FOUND.md` do not ship.

## 11. Claims about third parties carry their evidential strength

A framework's roadmap is a roadmap, not a shipped feature. A type declared in a
`.d.ts` is not thereby implemented — `useFactory` and `useExisting` are declared
in bootgs and resolve to `null` at runtime, and the skill says so. Every claim
of that kind states what it actually rests on, in the same sentence; that
labelling is what makes it safe to publish, so do not "tighten" it away.

Never assert wrongdoing by a named person or company. Never state that a name
is free to use, or that no patent applies.

## 12. Before anything leaves this repository

Run a pre-publication legal check against it and act on the blockers — the
audit covers the history, not just the working tree.

The `legal-publish-check` skill that does this is **not** in this repository. It
lives in the private `MaksymStoianov/skills-private`, is licensed
`LicenseRef-Proprietary`, and must not be copied here: a proprietary skill in a
public Apache-2.0 tree would be a licence violation, and `tests/repo/` would
fail on it. Run it from there, or read it there and apply it by hand.
