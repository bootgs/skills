<!-- SPDX-License-Identifier: Apache-2.0 -->

# Detecting a repo's own issue conventions

Gitea labels/scopes and issue templates are per-repository configuration.
Don't apply the taxonomy in `SKILL.md` blindly — confirm what this
particular repo actually has, and use that instead where it conflicts.

## 1. Issue templates

Gitea reads issue templates from, in order of precedence:

| Location | Form |
|---|---|
| `.gitea/issue_template/*.yaml` (or `.yml`) | Structured forms (Gitea's newer format — fields, dropdowns, checkboxes) |
| `.gitea/ISSUE_TEMPLATE/*.md` | Markdown templates with YAML frontmatter (`name`, `about`, `title`, `labels`) |
| `.gitea/.issue_template.md` | A single default template, no picker |
| `.github/ISSUE_TEMPLATE/*` | Legacy fallback some Gitea instances still honor on repos migrated from GitHub — check if the `.gitea/` variants are absent |

```bash
ls .gitea/issue_template/ .gitea/ISSUE_TEMPLATE/ 2>/dev/null
cat .gitea/.issue_template.md 2>/dev/null
```

If a template exists, use **its** field structure and default labels —
don't fall back to the generic paragraph-plus-checklist shape in
`SKILL.md` when the repo has already defined something more specific. If
several templates exist, match the one whose `name`/`about` fits the issue
being filed; ask the user if more than one plausibly fits.

## 2. Labels actually in use

```bash
tea labels list
```

`Kind/*` and `Priority/*` in `SKILL.md` are a reasonable *default*, not a
guarantee this repo uses them. Before applying a label:

- Confirm it exists in the output above — `tea` will reject an unknown
  label name.
- If the repo uses a different scope naming (`Type/*`, `Area/*`, a flat
  unscoped set, or no labels at all), follow what's actually there instead
  of introducing a new scope alongside it.
- Run `scripts/check-exclusive-labels.sh` on the final set regardless of
  naming — the same-scope conflict it catches applies to any `scope/value`
  label, not just `Kind`/`Priority`.

## 3. Written guidance

Check `CONTRIBUTING.md` (repo root or `.gitea/`) for anything that
overrides the defaults here — required sections, a preferred issue title
format, or a note about which labels are automation-managed and shouldn't
be set by hand.

## 4. Avoiding duplicates

```bash
tea issues list --state all --keyword "<a few keywords from the report>"
```

Check the results before drafting further — a near-duplicate is worth
linking to instead of filing again.

## 5. No template exists — offer to scaffold one

If §1 found nothing, the repo has no issue template at all. Don't silently
keep filing ad-hoc issues forever — **offer** the user a one-time scaffold
instead:

`assets/gitea-issue-templates/` ships ready examples of both real Gitea
formats:

- `bug_report.yaml`, `feature_request.yaml`, `config.yml` — the modern
  structured issue-form format (`.gitea/issue_template/*.yaml`)
- `legacy-markdown/bug_report.md` — the older Markdown-with-frontmatter
  format (`.gitea/ISSUE_TEMPLATE/*.md`), for repos that prefer something
  simpler than forms

Only write these into the repo if the user agrees — this is a repo-setup
action, separate from filing the issue at hand, not something to do
unprompted. If they agree:

1. Copy the relevant file(s) to `.gitea/issue_template/` (or
   `.gitea/ISSUE_TEMPLATE/` for the markdown variant).
2. Update each `labels:` value to a label that actually exists in this repo
   (§2) — the examples use `Kind/Bug`/`Kind/Feature` as placeholders.
3. Proceed with filing the current issue using the newly-scaffolded
   template, so it's exercised immediately rather than left untested.
