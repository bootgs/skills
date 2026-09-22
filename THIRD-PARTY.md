# Third-party content

Everything in this repository is Apache-2.0 (see `LICENSE`) **except** the
material listed here, which belongs to someone else and is redistributed under
its own licence. Each entry keeps its upstream licence text verbatim, next to
the files it covers.

`tests/repo/licensing.test.ts` fails if an entry's licence file is altered or if
vendored content is added without being listed here.

---

## `.agents/skills/skill-creator/`

| | |
|---|---|
| Upstream | [anthropics/skills](https://github.com/anthropics/skills) — `skills/skill-creator/` |
| Copyright | Copyright 2026 Anthropic, PBC. |
| Licence | Apache-2.0 |
| Licence text | `.agents/skills/skill-creator/LICENSE.txt`, retained verbatim |
| Recorded in | `skills-lock.json` (`sourceType: github`, with the content hash it was vendored at) |

Vendored, not modified — verified 2026-09-22 by comparing this copy of
`SKILL.md` byte for byte against the current upstream file (identical, 33168
bytes). Upstream ships no `NOTICE`, at the repository root or beside the skill,
so there is none to propagate; the `LICENSE.txt` that ships next to the skill is
the whole of the notice that must travel with it.

`skills-lock.json` records a `computedHash` for this entry. It is produced by
the `skills` CLI and is **not** a SHA-256 of `SKILL.md` — neither this copy nor
upstream hashes to it — so do not try to verify or update it by hand. Re-run the
CLI (`npm run skills:update`) when refreshing the copy, and commit the lockfile
it writes.

This directory is published through git, not through the npm tarball:
`package.json`'s `files` allowlist excludes it, so the package does not
redistribute it.

---

## Not third-party

These look like they might be, and are not:

- **`LICENSE`** at the repository root is this project's own licence. Its terms
  are the canonical Apache-2.0 text; only the appendix and the copyright line
  differ, which is how the licence is meant to be applied.
- **`template/scripts/fetch_policy.py`** and its vendored copies under
  `skills/*/scripts/` are this repository's own code. They are duplicated so
  each skill stays self-contained when installed alone, not because they came
  from elsewhere — `npm run sync:fetch-policy` regenerates them and
  `tests/repo/coverage.test.ts` fails if a copy drifts.
