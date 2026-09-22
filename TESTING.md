# Testing

Five layers. Only the last costs money.

| Layer | Lives in | Proves | Runner |
|---|---|---|---|
| Contract | `tests/skills/<name>/` | the skill is well-formed *for its family*, every figure is pinned or declared unpinnable, every cross-reference resolves | vitest |
| Unit | `tests/template/unit/` | the shared fetching module in isolation | vitest |
| Integration | `tests/template/integration/` | the fetching rules bind, over real HTTP against a loopback fixture | vitest |
| Live | `tests/template/integration/live.test.ts` | the shipped scripts still parse the real pages, and every value a skill documents still exists | vitest, `LIVE=1` |
| Repo | `tests/repo/` | invariants no single skill can see | vitest |
| Behaviour | `tests/skills/<name>/behaviour/` | the skill changes what the model does | `claude plugin eval` |

```bash
npm test                  # layers 1–4, offline
npm run test:watch
npm run test:live         # the same fetching rules against the real hosts
npm run test:prove        # break the tree on purpose; fail if the suite stays green
npm run test:behaviour    # layer 5 — spends money, see the budget below
```

`npm test` never leaves the machine: the live cases skip unless `LIVE=1`, so
CI stays offline and a vendor's outage can never turn the suite red.

**The skill is the unit under test.** `tests/skills/<name>/` is its test
directory. One thin file per skill sits over a shared contract:

```ts
import { describeSkill } from "@testkit/suite.ts";

describeSkill("bootgs-client");
```

`tests/` holds test cases and nothing else. The harness lives in
`scripts/testkit/` and is reached through the `@testkit` alias, so moving it
never touches a case.

| File | Role |
|---|---|
| `scripts/testkit/repo.ts` | skill discovery, an independent frontmatter parser, family classification, section and figure extraction |
| `scripts/testkit/suite.ts` | `describeSkill()` — the whole contract, family-aware; every threshold in the exported `LIMITS` |
| `scripts/testkit/python.ts` | async bridge to the Python module under test |
| `scripts/testkit/bridge.py` | JSON shim over `template/scripts/fetch_policy.py` |
| `scripts/testkit/httpfix.ts` | loopback HTTP fixture: routes, request log, response builder |
| `scripts/testkit/gen-behaviour.ts` | generates the eval case tree from each skill's authored eval set |

The frontmatter parser in `repo.ts` is deliberately independent of anything
this repository ships to its users. A test that parses a skill with the same
code the skill is validated by cannot catch that parser being wrong — it agrees
with itself.

## Families

A skill's family decides what the contract demands of it.

- **`bootgs`** — documents a framework this repository owns. Must carry
  `metadata.framework: bootgs` and say "bootgs" in its description, or it fires
  on plain Apps Script questions.
- **`apps-script`** — documents Google's platform. Must say it is
  framework-agnostic, or users who need it skip it as bootgs-only.

## Conventions the contract enforces

### Every figure is pinned, or declared unpinnable

A **figure** is a quantity a skill states as fact — `9 KB`, `6 hours`,
`>=22.14.0` — outside code blocks and outside a hedge like "~1-2 seconds".
Every figure must be **accounted for**, by one of:

- a **citation** — an `https://` link in the section that states it;
- a **live check** — a reference to a `check-*`/`fetch-*` script that re-derives
  it from the source;
- an **unpinnable declaration** — a sentence carrying one of the phrases in
  `UNPINNABLE_MARKERS` (`change without notice`, `as of this writing`,
  `verify against`, …).

The accounting normally sits in the same section as the figure. It may sit
elsewhere in the skill if that line **names the figure literally**, so the
exception travels with the number instead of covering a file by implication.

Fee schedules, inflation-adjusted penalties and annually republished thresholds
are legitimately unpinnable — say so. A stated exception is auditable; silence
looks identical to an oversight.

Scope matters: a superseded figure in a change log is the change log working;
the same figure in a rules table is a wrong answer waiting to be quoted.

### A description is a trigger, not a summary

Every description must say when to fire (`Use when …`) **and**, where the skill
has same-family siblings, name at least one of them in a hand-off clause.
Without a hand-off the eval set can only measure recall: a skill that fires on
everything scores perfectly and is useless.

### Fetching is auditable, with no override flag

Every script that reaches the network goes through
`template/scripts/fetch_policy.py`, vendored into each skill by
`npm run sync:fetch-policy` so the skill still works installed on its own. It:

- names the script and this repository in the User-Agent, and never
  impersonates a browser;
- reads `robots.txt` before the target — an unreadable one (5xx, timeout)
  disallows everything, a missing one (4xx) allows everything;
- honours crawl-delay and never exceeds one request per second per host;
- stops on 403/429/503 and reports, rather than retrying;
- says when an answer came from a stored copy instead of the live source.

Nothing a skill fetched goes into version control — see `corpus/README.md`.

## The live layer

The fixture layer proves the rules bind over real HTTP, but every response it
grades is one this repository wrote. It cannot catch the failure that actually
happens: a vendor restructures a page and a shipped script stops parsing it, or
a value a skill documents stops existing.

`npm run test:live` covers that: `robots.txt` on each real host, every shipped
fetching script end to end, and a check that every `--integration` value the
marketplace skill documents still appears on Google's page. That last one is
there because `Drive app` was documented here while Google called it
`Google Drive app` — found by running a script by hand, not by a test.

It is slow on purpose. The fetching policy paces itself to one request per
second per host and reads `robots.txt` before each origin; that is the
behaviour under test, not overhead to route around.

## Behaviour layer

Cases are generated from each skill's authored eval set in
`tests/skills/<name>/evals.ts` rather than written twice. The generated tree is
committed so it is reviewable in a diff, and `tests/repo/behaviour.test.ts`
fails when it has drifted from its source.

```bash
npm run test:behaviour:gen                                   # regenerate
claude plugin eval . --eval-dir tests/skills --max-cost-usd 0 --allow-tools Bash WebFetch
```

`--max-cost-usd 0` loads every case and aborts before spending anything: use it
to validate the suite for free.

**Ablation is the point.** Each case runs with the plugin and without it, and
`Δ` is what the plugin contributed. A case scoring 1.0 in both arms is evidence
the base model already knew, not that the skill works. A `tool_used: Skill`
grader is marked `arm: with-only` — the baseline has no skill to fire, and
scoring it there marks the baseline down for the plugin's absence.

Gated tools (`Bash`, `WebFetch`) need `--allow-tools`, or a skill cannot run its
own gate and every gate expectation fails for the wrong reason.

**Budget:** 22 cases × 2 runs × 2 arms = 88 agent runs, plus 3 judge calls per
`llm` grader per run. This is a release gate, never a commit gate.

## Proving the checks fire

`npm run test:prove` applies 14 mutations one at a time — an edited licence, a
dropped SPDX id, a script that bypasses the fetching policy, an unpinned figure,
a drifted behaviour tree — and fails if the suite stays green for any of them.
A green suite is only evidence if red is reachable.

## Known environment notes

- The integration layer binds a loopback listener. Under a sandbox that blocks
  `listen()` on `127.0.0.1` every case fails with `EPERM`; that is the sandbox,
  not the code.
- Python writes `__pycache__/` beside a vendored `fetch_policy.py` once a skill
  script has run. It is git-ignored.
