<!-- SPDX-License-Identifier: Apache-2.0 -->

# Issue body templates by type

Use these only when the repo has no issue template of its own (see
`references/detecting-conventions.md` §1). Pick the template matching the
`Kind/*` label (or the repo's own type scope) being applied.

## Bug (`Kind/Bug`)

```markdown
### Description
[Clear explanation of the problem]

### Expected
[What should happen]

### Actual
[What happens instead]

### Steps to reproduce
1. [Step-by-step reproduction]

### Environment
[Version, OS, and anything else relevant to reproducing it]

### Checklist
- [ ] Reproduced on the latest version
- [ ] Add/update a regression test
```

## Feature / Enhancement (`Kind/Feature`, `Kind/Enhancement`)

```markdown
### Goal
[What this adds and why: the problem it solves]

### Background
[Current state, the gap, and any context needed to plan the work]

### Scope
[Concrete list of what changes]

### Checklist
- [ ] Implement the change
- [ ] Add/update tests
- [ ] Update docs if public behavior changed
```

## Tech debt

```markdown
### Current state
[What the code/system looks like today and why it's problematic]

### Proposed improvement
[What the improved state should look like]

### Motivation
[Why this matters — maintainability, performance, DX, etc.]

### Checklist
- [ ] Implement the change
- [ ] Confirm no behavior change (or document the intended one)
```

## Spike / investigation

```markdown
### Goal
[What question(s) this answers]

### Context
[Why this investigation is needed now]

### Questions
1. [Specific question to resolve]

### Expected output
[Deliverable: doc, PoC, decision, etc.]

### Checklist
- [ ] Each question above answered
- [ ] Deliverable produced and linked here
```

A body that's one short paragraph of context plus a checklist reads better
than free-form prose, both for humans and for closing-PR auto-linking
(`Closes #42`) — keep the paragraph to the *why*, put the *what* in the
checklist so progress is trackable from the issue list view.
