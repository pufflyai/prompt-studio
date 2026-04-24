---
layout: ../../../layouts/docs-layout.astro
title: Use local ticket files
description: Edit ticket markdown in your editor and sync with the Prompt Studio database.
htmlTitle: Local ticket files
htmlDescription: Edit ticket markdown in your editor under .pstdio/tickets and sync the changes back to Prompt Studio.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 2
---

## The local layout

When CLI commands run inside a configured project, Prompt Studio writes a per-ticket folder under `.pstdio/tickets/<shorthand>/`:

```text
.pstdio/tickets/PS-42/
  ticket.md
  files/
    design-mock.png
  artifacts/
    agent-run.log
```

- **`ticket.md`** — markdown body plus YAML frontmatter for metadata.
- **`files/`** — user-attached files.
- **`artifacts/`** — files produced during agent runs.

## Ticket frontmatter

```yaml
---
ticket_id: "PS-42"
user_prompt: "Add onboarding empty states to the dashboard"
created: "2025-11-02T14:30:11.200Z"
draft: false
status_name: "ready"
tag_names: ["frontend", "urgent"]
---
```

Fields:

- **`ticket_id`** — populated by Prompt Studio. Do not change.
- **`user_prompt`** — short prompt sent when the agent starts.
- **`status_name`** — ticket status name (must exist in the project's statuses).
- **`tag_names`** — array of tag names already registered in the project.
- **`draft`** — whether the ticket is a draft.

Anything below the frontmatter is the ticket body (markdown).

## Round-trip

Pull the latest ticket from the server:

```bash
pstdio tickets pull --id PS-42           # single ticket
pstdio tickets pull                      # all non-archived tickets
pstdio tickets pull --id PS-42 --force   # overwrite local edits
```

Push local changes back to the server:

```bash
pstdio tickets save --id PS-42
pstdio tickets save --id PS-42 --status ready --tag urgent
```

`save` uploads the body, status (`--status`), and tags (`--tag`, repeatable). Files under `files/` are uploaded too; `artifacts/` stays local.

## Inspect attached files

```bash
pstdio tickets files --id PS-42
```

Shows the files registered server-side and the ones present locally that are not yet uploaded.

## When `ticket.md` grows

Large tickets are easier to work with in your editor than in the dashboard, especially if you are pairing with an agent that can grep the file. Keep your local copy in sync with `pull` before editing and `save` after.

## Related pages

- [Create and refine tickets](/docs/workflows/create-tickets/) — starting points for new tickets.
- [Attach files and artifacts](/docs/workflows/files-and-artifacts/).
- [`pstdio tickets` reference](/docs/reference/cli/tickets/) — every CLI option.
