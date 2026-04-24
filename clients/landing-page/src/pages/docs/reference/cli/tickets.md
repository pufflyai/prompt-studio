---
layout: ../../../../layouts/docs-layout.astro
title: pstdio tickets
description: Reference for the pstdio tickets command group, including worktrees subcommands.
htmlTitle: pstdio tickets CLI
htmlDescription: Create, list, update, and implement tickets in Prompt Studio, plus the worktrees subcommands.
section: References
category: CLI
categoryOrder: 1
order: 3
---

## pstdio tickets create

Create a ticket directly in the database.

**Options:**

- `--content <markdown>` (required) — ticket body.
- `--project-id <id>` — project id. Falls back to the current project.
- `--status <name>` — status name to assign on create.
- `--tag <name>` (repeatable) — tags to assign.

**SDK equivalent:** `client.tickets.create(input)` → `POST /v1/tickets`.

## pstdio tickets write

Create a draft ticket with a local file at `.pstdio/tickets/<shorthand>/ticket.md`.

**Options:**

- `--title <string>` (required) — ticket title (becomes the first heading).
- `--template <name>` — template to seed the body with.
- `--tag <name>` (repeatable) — tags to assign.
- `--status <name>` — status to assign.
- `--user-prompt <string>` — initial user prompt stored with the ticket.
- `--parent-id <shorthand>` — create as a sub-ticket.

## pstdio tickets save

Save local ticket content and files to the database.

**Options:**

- `--id <shorthand>` (required) — e.g. `PS-12`.
- `--status <name>` — set status on save.
- `--tag <name>` (repeatable) — replace tag set.

## pstdio tickets pull

Pull ticket content and files from the database.

**Options:**

- `--id <shorthand>` — ticket to pull. Omit to pull all non-archived tickets.
- `--force` — overwrite existing local files.

## pstdio tickets list

List tickets.

**Options:**

- `--project-id <id>` — project id.
- `--status <name>` — filter by status.
- `--tag <name>` (repeatable) — filter by tag.
- `--archived` — include archived.
- `--draft` — include drafts.
- `--parent-id <shorthand>` — filter by parent ticket.

**SDK equivalent:** `client.tickets.list(projectId, input)` → `GET /v1/tickets`.

## pstdio tickets view [field]

View ticket details, or a single field.

**Positional args:**

- `field` (optional) — `status`, `title`, `tags`, or `shorthand`.

**Options:**

- `--id <shorthand>` (required) — ticket shorthand.
- `--project-id <id>` — project id.

## pstdio tickets update

Update ticket status or tags.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.
- `--status <name>` — new status.
- `--tag <name>` (repeatable) — replace tags.

**SDK equivalent:** `client.tickets.update(ticketId, input)` → `PATCH /v1/tickets/{id}`.

## pstdio tickets implement

Move ticket to WIP and launch an agent.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.

## pstdio tickets files

List database and local files for a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.

**SDK equivalent:** `client.tickets.listFiles(ticketId)`.

## pstdio tickets workspaces

List active workspaces linked to a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.
- `--json` — machine-readable output.

## pstdio tickets update-when-attempt-status

Update a ticket's status when all its attempts share a given attempt status.

**Options:**

- `--id <shorthand>` (required).
- `--all-attempts-status <name>` (required) — required attempt status for every workspace.
- `--set-status <name>` (required) — ticket status to apply if the condition holds.
- `--project-id <id>`.

**SDK equivalent:** `client.tickets.updateWhenAttemptStatus(ticketId, input)`.

## pstdio tickets archive

Archive a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.

## pstdio tickets delete

Delete a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.

## pstdio tickets worktrees

### pstdio tickets worktrees list

List worktrees linked to a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.
- `--json` — machine-readable output.

### pstdio tickets worktrees remove-all

Remove every worktree for a ticket.

**Options:**

- `--id <shorthand>` (required).
- `--project-id <id>`.

## Related pages

- [Create and refine tickets](/docs/workflows/create-tickets/).
- [Local ticket files](/docs/workflows/local-ticket-files/).
- [`client.tickets` reference](/docs/reference/sdk/client/#clienttickets).
