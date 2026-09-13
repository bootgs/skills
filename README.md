# Boot.gs Skills

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![skills.sh](https://skills.sh/b/bootgs/skills)](https://skills.sh/bootgs/skills)

Agent Skills for [boot.gs](https://github.com/bootgs/boot) – a NestJS/Spring Boot-style framework for Google Apps Script (decorators, dependency injection, routing, validation) — plus a set of skills for plain Google Apps Script development that don't require boot.gs at all.

Each skill is a self-contained directory under [`skills/`](./skills) with a `SKILL.md` file and, where useful, `scripts/`, `references/`, or `assets/`. The format follows the open [Agent Skills specification](https://agentskills.io/specification), so every skill here works with any agent that implements it – not just Claude. An [`llms.txt`](./llms.txt) at the repo root gives agents and crawlers a short index of what's here.

## Skills

### Boot.gs

| Skill | Description |
|---|---|
| [`bootgs-quickstart`](./skills/bootgs-quickstart) | Bootstraps a new boot.gs project: `tsconfig`, manifest, `clasp`, entry points. |
| [`bootgs-architecture`](./skills/bootgs-architecture) | Controller → Service → Repository → Domain layering, the Interface+Impl convention, and a working `eslint-plugin-boundaries` config. |
| [`bootgs-validation`](./skills/bootgs-validation) | Parameter validation (`@Min`, `@Max`, `@Email`, ...), Parse pipes, custom pipes. |
| [`bootgs-client`](./skills/bootgs-client) | The Virtual Transport Layer contract and a client for `doGet`/`doPost`/`google.script.run`. |
| [`bootgs-openapi`](./skills/bootgs-openapi) | Generates an OpenAPI 3.0 spec from `@RestController` classes via the TypeScript Compiler API. |

### apps-script (framework-agnostic)

| Skill | Description |
|---|---|
| [`apps-script-triggers`](./skills/apps-script-triggers) | Simple vs. installable triggers, event shapes, quotas. |
| [`apps-script-services`](./skills/apps-script-services) | Quota-safe use of `SpreadsheetApp`, `PropertiesService`, `CacheService`, `LockService`, `UrlFetchApp`; V8 runtime API gaps; custom spreadsheet functions. |
| [`apps-script-ui`](./skills/apps-script-ui) | Menus, sidebars, modal dialogs, the progress-spinner pattern, and the private-function `google.script.run` pitfall. |
| [`apps-script-clasp-workflow`](./skills/apps-script-clasp-workflow) | The `clasp` CLI: push/deploy, versioning, multi-environment setups. |
| [`apps-script-utils`](./skills/apps-script-utils) | The `apps-script-utils` guard/utility library. Independent of boot.gs, but used by it internally — already available in a boot.gs project with no extra install. |
| [`apps-script-marketplace-publish`](./skills/apps-script-marketplace-publish) | Audits an add-on against the current Google Workspace Marketplace requirements (fetched live from the official docs) and guides publishing. |

## Installation

Skills run with the full permissions of whatever agent loads them. Read a skill's `SKILL.md` and any bundled `scripts/` before installing it, the same way you would before running someone else's code.

### Claude Code

Register this repository as a plugin marketplace:

```
/plugin marketplace add bootgs/skills
```

Install just the boot.gs skills, just the framework-agnostic ones, or both:

```
/plugin install bootgs@bootgs-skills
/plugin install apps-script@bootgs-skills
```

### Gemini CLI

Install every skill in one extension, discovered automatically from the root [`gemini-extension.json`](./gemini-extension.json) and [`skills/`](./skills):

```bash
gemini extensions install https://github.com/bootgs/skills
```

To install just the bootgs skills or just the framework-agnostic ones, this repository also ships a Gemini CLI marketplace manifest (`.agents/plugins/marketplace.json`, following the pattern used by [google/skills](https://github.com/google/skills/blob/main/.agents/plugins/marketplace.json)), with the same two groups packaged as standalone extensions under [`plugins/`](./plugins). Installing a single group from a URL requires cloning first, since `gemini extensions install` only reads a `gemini-extension.json` from the exact path given:

```bash
git clone https://github.com/bootgs/skills
gemini extensions install ./skills/plugins/bootgs
gemini extensions install ./skills/plugins/apps-script
```

`plugins/bootgs/skills` and `plugins/apps-script/skills` are symlinks into [`skills/`](./skills) — content isn't duplicated.

### Any agent, via `npx skills`

Skills also install with the [`skills` CLI](https://github.com/vercel-labs/skills), which supports Claude Code, Cursor, Codex, Gemini CLI, and dozens of other agents:

```bash
npx skills add bootgs/skills --skill bootgs-quickstart
```

## Try it

Once a skill is installed, prompt the agent in plain language — it decides on its own when a skill applies:

- `Set up a new boot.gs project for a Sheets add-on.`
- `Add a page/limit query parameter to this boot.gs controller, validated and bounded.`
- `Build a client for my boot.gs backend that works inside a Sheets sidebar.`
- `Regenerate the OpenAPI spec for this boot.gs project and check it's not stale.`
- `Why does this onEdit trigger work for me but not for other editors?`
- `This add-on keeps failing Marketplace review — check it against the current checklist.`

## Development

### Managing skills

`package.json` wraps the `skills` CLI so the flags don't need to be memorized:

```bash
npm run skills:init             # scaffold a new SKILL.md
npm run skills:add -- <source>  # install a skill from a source
npm run skills:list             # list installed skills
npm run skills:find             # search for skills
npm run skills:use              # preview a skill without installing it
npm run skills:update           # update installed skills
npm run skills:remove           # remove an installed skill
```

`skills:add` always targets `--agent '*'`: everything installs into `.agents/skills/` as the canonical copy, and the CLI symlinks it into whichever other agent directories already exist in the project — there's no hardcoded agent list to keep in sync, since a clone of this repo may be used with agents we don't know about in advance.

This repository's own tooling — the [`skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) skill, used to draft and iterate on the skills above — lives under `.agents/skills/`, installed the same way:

```bash
npm run skills:add -- anthropics/skills --skill skill-creator
```

## Support

Found a skill that's wrong, out of date, or misfiring? Open an issue in the [issue tracker](https://github.com/bootgs/skills/issues).

## Contributing

Issues and pull requests are welcome — a corrected gotcha, a new skill, or a report that a live-fetched script broke because Google or the bootgs API changed shape are all useful.

## License

[Apache License 2.0](./LICENSE)
