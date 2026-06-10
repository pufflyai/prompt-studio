---
name: create-ticket
description: "Create a planner ticket. Use when asked to make changes unrelated to an existing ticket or when asked to create a new ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Treat planner tickets as extension resources, not legacy local files. Planner tickets are stored by the `pstdio-planner` extension and use:
   - internal resource id: the stable id passed by planner sessions and workbench commands
   - display shorthand: `<PROJECT_SHORTHAND>-<number>` on cards and lists, for example `PS-12`
   - body: markdown content stored on the ticket resource
   - files: attached planner ticket files, not `.pstdio/tickets/<shorthand>/files/`
2. Decide the ticket status:
   - If the user explicitly asked to create a ticket, use the backlog/default planner status.
   - Otherwise use the in-progress planner status when available.
3. Create the ticket through the planner resource flow when available: dashboard create modal, command palette, or host-provided `pstdio-planner.create-ticket` command. Derive a concise, verb-led ticket title from the user request. Add priority/type tags if relevant.
4. Fill the ticket body with concrete details. Use information from researching the codebase and documentation:
   - Parallelizable (yes/no)
   - References to existing docs (if any), otherwise record gaps as assumptions
   - Implementation Notes with key files/modules and decisions
   - Acceptance with explicit tests, file paths, and exact commands
   - Documentation updates, or an explicit “no docs” note
   - Track missing information with [MISSING INFORMATION] tags in the ticket.
5. When defining acceptance, list the test file paths, cases covered, and commands to run. Tests belong with the functional change they validate, do not create standalone “add tests” tickets.
6. Resolve blockers by checking existing non-done planner tickets. If another ticket blocks this one, record it in the ticket body and set the planner blocker fields/status when those controls are available.
7. Stop after the planner ticket is created and persisted unless the user explicitly asked to implement it. Otherwise start implementation and follow the implement-ticket skill.

## Cheatsheet

### Planner Ticket Source Of Truth

- Use the planner ticket resource id when a planner session passes `ticket`.
- Use the display shorthand only for human-facing text.
- Do not run legacy `pst tickets pull/save/update` for planner extension tickets.
- Use planner ticket files for supporting resources when the host exposes ticket file actions.

### Legacy CLI Tickets

Only use these commands when the user explicitly asks for a legacy `.pstdio/tickets` CLI ticket instead of a planner extension ticket.

#### List Valid Templates (`templates list`)

Use this before `tickets write --template` to pick a valid template name for the current project.

```bash
pst templates list
```

Bundled ticket templates: `ticket`, `proposal`.

#### List Valid Tags (`tags list`)

Use this before `--tag` flags to ensure tag names exist in the current project.

```bash
pst tags list
```

#### Create Draft Ticket (`tickets write`)

Use this to generate local ticket files from a title/prompt, then fill in implementation and acceptance details before publish.

```bash
pst tickets write --title "<title>" [--user-prompt "<prompt>"] [--template <template-name>] [--status <status>] [--tag <tag>] [--parent-id <shorthand>]
```

#### Create Ticket Directly (`tickets create`)

Use this when you already have canonical ticket content and want to skip the local draft/edit loop.

```bash
pst tickets create --content "<content>" [--status <status>] [--tag <tag>] [--parent-id <shorthand|id>]
```

#### List Tickets (`tickets list`)

Use this to find blockers, related tickets, and parent/child relationships before setting `depends_on`.

```bash
pst tickets list [--status <status>] [--tag <tag>] [--archived] [--draft] [--parent-id <shorthand>]
```

#### Update Ticket Status (`tickets update`)

Use this during ticket creation/refinement when no implementation attempt status exists yet (for example, marking a newly created ticket as `blocked` because of dependencies).

```bash
pst tickets update --id "<shorthand>" [--status <status>] [--tag <tag>] [--parent-id <shorthand|id>] [--no-parent-id]
```

#### Save Ticket Changes (`tickets save`)

Use this after editing local files so the ticket content and artifacts are published.

```bash
pst tickets save --id "<shorthand>" [--status <status>] [--tag <tag>]
```

## Output Locations

- Planner tickets: `pstdio-planner` extension ticket resources
- Planner supporting files: ticket files attached to the planner ticket resource
- Legacy CLI tickets: `.pstdio/tickets/<shorthand>/ticket.md`
