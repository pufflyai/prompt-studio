---
name: create-ticket
description: "Create a ticket via pstdio. Use when asked to make changes unrelated to an existing ticket or when asked to create a new ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Decide the ticket status:
   - If the user explicitly asked to create a ticket, use status `backlog`.
   - Otherwise use status `wip`.
2. Write a ticket draft using `pstdio tickets write`. Derive a concise, verb-led ticket title from the user request for the ticket title. Add tags if relevant. Use templates if requested, or relevant.
3. Fill the resulting ticket at `.pstdio/tickets/<shorthand>/ticket.md` with concrete details. Use information from researching the codebase and documentation:
   - Parallelizable (yes/no)
   - References to existing docs (if any), otherwise record gaps as assumptions
   - Implementation Notes with key files/modules and decisions
   - Acceptance with explicit tests, file paths, and exact commands
   - Documentation updates, or an explicit “no docs” note
   - Track missing information with [MISSING INFORMATION] tags in the ticket.
4. When defining acceptance, list the test file paths, cases covered, and commands to run. Tests belong with the functional change they validate, do not create standalone “add tests” tickets.
5. Resolve blockers by checking all existing tickets that are not done. If another ticket is a blocker, add it to `depends_on` in frontmatter.
   - If blocked, run `pstdio tickets update --id "<shorthand>" --status blocked`.
6. Run `pstdio tickets save --id "<shorthand>"` to persist the updated ticket content.
7. If the user only asked to create the ticket, stop after the ticket file(s) are created and saved and do not implement it. Otherwise start the ticket implementation and follow instructions in the implement-ticket skill.

## Cheatsheet

### List Valid Templates (`templates list`)

Use this before `tickets write --template` to pick a valid template name for the current project.

```bash
pstdio templates list
```

Bundled ticket templates: `ticket`, `proposal`.

### List Valid Tags (`tags list`)

Use this before `--tag` flags to ensure tag names exist in the current project.

```bash
pstdio tags list
```

### Create Draft Ticket (`tickets write`)

Use this to generate local ticket files from a title/prompt, then fill in implementation and acceptance details before publish.

```bash
pstdio tickets write --title "<title>" [--user-prompt "<prompt>"] [--template <template-name>] [--status <status>] [--tag <tag>] [--parent-id <shorthand>]
```

### Create Ticket Directly (`tickets create`)

Use this when you already have canonical ticket content and want to skip the local draft/edit loop.

```bash
pstdio tickets create --content "<content>"  [--status <status>] [--tag <tag>]
```

### List Tickets (`tickets list`)

Use this to find blockers, related tickets, and parent/child relationships before setting `depends_on`.

```bash
pstdio tickets list [--status <status>] [--tag <tag>] [--archived] [--draft] [--parent-id <shorthand>]
```

### Update Ticket Status (`tickets update`)

Use this during ticket creation/refinement when no implementation attempt status exists yet (for example, marking a newly created ticket as `blocked` because of dependencies).

```bash
pstdio tickets update --id "<shorthand>" [--status <status>] [--tag <tag>]
```

### Save Ticket Changes (`tickets save`)

Use this after editing local files so the ticket content and artifacts are published.

```bash
pstdio tickets save --id "<shorthand>" [--status <status>] [--tag <tag>]
```

## Output Locations

- Tickets: `.pstdio/tickets/<shorthand>/ticket.md`
- Supporting Files: `.pstdio/tickets/<shorthand>/files/`
- Validation Artifacts: `.pstdio/tickets/<shorthand>/artifacts/`
