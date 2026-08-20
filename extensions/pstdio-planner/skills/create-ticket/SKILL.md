---
name: create-ticket
description: "Create a planner ticket. Use when asked to make changes unrelated to an existing ticket or when asked to create a new ticket."
metadata:
  version: 0.0.3
---

Manage Planner tickets with the `pst tickets` commands.

## Workflow

1. List the available statuses, tags, and templates with `pst statuses list`, `pst tags list`, and `pst templates list`. Do not assume their names. Use `pst tickets list` to check for related work.
2. Choose how to create the ticket.
   - For a detailed body, run `pst tickets write --title "<verb-led title>" [--status <status>] [--tags <tag>]`. Apply a template with `pst templates write --name <template> --ticket <shorthand>`, edit `.pstdio/tickets/<shorthand>/ticket.md`, then save it with `pst tickets save --id <shorthand>`.
   - If the complete body already exists, run `pst tickets create --content "<markdown>" [--status <status>] [--tags <tag>]`. The first heading becomes the title.
3. Read the relevant code and documentation before writing the body. Mark unanswered questions with `[MISSING INFORMATION]`.
4. Complete every applicable template section. A free-form ticket must still include:
   - References, or a note that no useful documentation exists.
   - The work in scope and the checks or tests that will prove it works.
   - The real files or modules involved, plus assumptions and gaps.
   - Required documentation changes, or `None`.
   - `parallelizable` and `depends_on` in the frontmatter.
5. Put priority and type in tags from `pst tags list`. Repeat `--tags` when needed.
6. Check unfinished tickets with `pst tickets list`. If another ticket blocks this one, add it to `depends_on` and run `pst tickets update --id <shorthand> --status <status> --blocked-reason "<why>"`.
7. Stop after saving the ticket unless the user also asked for implementation. In that case, follow the `implement-ticket` skill.

## Example

```bash
pst tickets write --title "Add retry to upload client"
# Apply a template if needed, then edit .pstdio/tickets/PS-42/ticket.md.
pst tickets save --id PS-42
```

## Reference

Pass a ticket shorthand such as `PS-42` to `--id`. The command resolves it to the stored ticket.
