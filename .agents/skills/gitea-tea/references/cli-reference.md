<!-- SPDX-License-Identifier: Apache-2.0 -->

# tea CLI reference

Flags verified against `tea`'s own generated reference (`docs/CLI.md` in [gitea/tea](https://gitea.com/gitea/tea)). Load this file when a command needs a flag not shown in `SKILL.md`'s examples — don't guess a flag name.

## Contents

- [Common flags](#common-flags)
- [issues](#issues)
- [pulls](#pulls)
- [labels](#labels)
- [comments](#comments)
- [milestones](#milestones)
- [releases](#releases)
- [login](#login)

## Common flags

These accept on nearly every subcommand — omitted below unless a subcommand adds something entity-specific:

| Flag | Meaning |
|---|---|
| `--login, -l` | Use a different stored Gitea login |
| `--remote, -R` | Discover the login from a specific git remote instead of the default |
| `--repo, -r` | Override the repository (local path or `owner/repo` slug) |
| `--output, -o` | `simple`, `table`, `csv`, `tsv`, `yaml`, or `json` |
| `--limit, --lm` | Items per page (default 30) |
| `--page, -p` | Page number (default 1) |

## issues

### `issues list`

| Flag | Meaning |
|---|---|
| `--state` | `all`, `open`, or `closed` |
| `--kind, -K` | `issues`, `pulls`, or `all` |
| `--labels, -L` | Comma-separated label names to filter by |
| `--milestones, -m` | Comma-separated milestone names to filter by |
| `--assignee, -a` / `--author, -A` / `--mentions, -M` | Filter by user |
| `--keyword, -k` | Search string |
| `--from, -F` / `--until, -u` | Filter by activity date range |
| `--fields, -f` | Columns to print — `index,state,kind,author,author-id,url,title,body,created,updated,deadline,assignees,milestone,labels,comments,owner,repo` |

### `issues create`

| Flag | Meaning |
|---|---|
| `--title, -t` | Required |
| `--description, -d` | Body text (single value) |
| `--description-file` | Read body from a file, or `-` for stdin — prefer this for multi-line/checklist bodies |
| `--assignees, -a` | Comma-separated usernames |
| `--labels, -L` | Comma-separated label names |
| `--milestone, -m` | Milestone name |
| `--deadline, -D` | Deadline timestamp |
| `--referenced-version, -v` | Commit hash or tag to associate |

### `issues edit`

No `--labels`/`--assignees` — use the add/remove/set variants instead:

| Flag | Meaning |
|---|---|
| `--title, -t` / `--description, -d` / `--description-file` | Replace title/body |
| `--add-labels, -L` | Add labels (comma-separated) |
| `--remove-labels` | Remove labels |
| `--add-assignees, -a` | Add assignees — takes precedence over `--remove-assignees` |
| `--remove-assignees` | Remove assignees |
| `--set-assignees` | Replace the whole assignee list — takes precedence over add/remove |
| `--milestone, -m` / `--deadline, -D` | Same as create |

### `issues close` / `issues reopen`

No entity-specific flags beyond the common ones — takes one or more issue indices as arguments.

## pulls

### `pulls list`

Same shape as `issues list`, plus `--fields` includes `mergeable,base,base-commit,head,diff,patch,ci`.

### `pulls checkout`

| Flag | Meaning |
|---|---|
| `--branch, -b` | Create a local branch if one doesn't already exist |

### `pulls create`

Same core flags as `issues create`, plus:

| Flag | Meaning |
|---|---|
| `--base, -b` | Target branch (default: repo's default branch) |
| `--head` | Source branch; `<user>:<branch>` for a different head repo |
| `--draft` | Prefixes the title with `WIP: ` (Gitea's draft convention) |
| `--allow-maintainer-edits, --edits` | Let maintainers push to the head branch |
| `--agit` / `--topic` | agit-flow pull request creation |

### `pulls edit`

Same shape as `issues edit`.

### `pulls approve` / `pulls reject`

No entity-specific flags — takes a PR index.

### `pulls merge`

| Flag | Meaning |
|---|---|
| `--style, -s` | `merge`, `rebase`, `squash`, or `rebase-merge` (default `merge`) — must match what the repo's branch protection allows |
| `--title, -t` / `--message, -m` | Merge commit title/message |

### `pulls clean`

| Flag | Meaning |
|---|---|
| `--ignore-sha` | Match the local branch by name instead of commit hash (less precise) |

### `pulls review-comments` / `resolve` / `unresolve` / `reply`

No entity-specific flags beyond the common ones — operate on review threads by ID.

## labels

### `labels list`

| Flag | Meaning |
|---|---|
| `--org` | List organization-level labels instead of repo labels |
| `--exclude-org` | Exclude org labels from a repo listing |
| `--save, -s` | Save the listing to a file |

### `labels create`

| Flag | Meaning |
|---|---|
| `--name` | Required |
| `--color` | Hex color |
| `--description` | Label description |
| `--file` | Import from a label definitions file instead of one-by-one |

No `--exclusive` flag exists — see the skill's Gotchas.

### `labels update`

Same as `create`, keyed by `--id` instead of creating new.

### `labels delete`

Takes `--id` — no name-based deletion.

## comments

| Command | Notes |
|---|---|
| `comment <issue> "<text>"` / `comment add` | `--description, -d` is the body if not given positionally |
| `comment list <issue>` | Standard pagination flags |
| `comment edit <id>` | `--description, -d` for the new body |
| `comment delete <id>` | One or more comment IDs |

## milestones

| Command | Key flags |
|---|---|
| `milestones create` | `--title, -t`, `--description, -d`, `--deadline/--expires, -x`, `--state` |
| `milestones close` | `--force, -f` deletes instead of closing |
| `milestones issues add/remove` | Attach/detach an issue or PR to a milestone |

## releases

| Command | Key flags |
|---|---|
| `releases create` | `--tag` (created if it doesn't exist), `--target`, `--title, -t`, `--note, -n` / `--note-file, -f`, `--draft, -d`, `--prerelease, -p`, `--asset, -a` (repeatable) |
| `releases edit` | Same fields, plus `--draft`/`--prerelease` take an explicit `true`/`false` |
| `releases delete` | Requires `--confirm, -y`; `--delete-tag` also removes the git tag |

## login

| Command | Notes |
|---|---|
| `login add` | `--url, -u` (default `https://gitea.com`), `--token, -t`, `--name, -n`; or `--oauth`, `--ssh-key`/`--ssh-agent-key`, `--user`+`--password` for other auth methods |
| `login add --git-credentials` | Registers `tea` as a git credential helper so `git push`/`clone` over HTTPS authenticate silently |
| `login default` | Get or set the default login when multiple are configured |
| `login status` | Show auth status per configured login |
