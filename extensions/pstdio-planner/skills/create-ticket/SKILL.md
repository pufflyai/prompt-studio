---
name: create-ticket
description: "Create a planner ticket. Use when asked to make changes unrelated to an existing ticket or when asked to create a new ticket."
metadata:
  version: 0.0.2
---

Manage planner tickets with the `pst tickets …` CLI.

## Workflow

1. **Survey the catalogs.** Statuses, tags, and templates are project-configurable — list them and pick from what exists, never assume names: `pst statuses list`, `pst tags list`, `pst templates list`. Use `pst tickets list` to scan existing tickets.
2. **Create the ticket.** Choose one path:
   - Draft-and-edit (preferred when the body needs real detail): `pst tickets write --title "<verb-led title>" [--status <status>] [--tags <tag>]` creates the ticket and lays down `.pstdio/tickets/<shorthand>/ticket.md`. To scaffold from a template, apply one of the listed ticket templates with `pst templates write --name <template> --ticket <shorthand>`. Fill the file, then `pst tickets save --id <shorthand>` to persist it and clear the draft flag.
   - One-shot (when you already have the full body): `pst tickets create --content "<markdown>" [--status <status>] [--tags <tag>]`. The title is derived from the first heading.
3. **Research before writing the body.** Read the relevant code and docs so the ticket is concrete and implementation-ready. Track open questions inline with `[MISSING INFORMATION]`.
4. **Write a concrete, testable body** — fill every section of the template you applied, or cover the same ground in a free-form body:
   - The references you relied on, or the gap if none.
   - Scope, and how the work is validated — the checks or tests that cover it and the commands to run them (where the repo has them). Validation ships with the change it covers — don't split it into a separate ticket.
   - Implementation notes: the real files/modules to touch, plus assumptions or gaps.
   - Documentation updates, or an explicit "none required".
   - Frontmatter: set `parallelizable` and `depends_on`.
5. **Priority and type are tags, not body sections.** Set them with `--tags` (repeatable, e.g. `--tags <priority> --tags <type>`) using names from `pst tags list`.
6. **Resolve blockers.** Check non-done tickets with `pst tickets list`. If another ticket blocks this one, record it in `depends_on` and set a blocking status with `pst tickets update --id <shorthand> --status <status> --blocked-reason "<why>"`.
7. **Stop once the ticket is saved**, unless the user asked to implement it — then follow the implement-ticket skill.

## Example

```bash
pst tickets write --title "Add retry to upload client"
# optionally scaffold a template, then fill .pstdio/tickets/PS-42/ticket.md
pst tickets save --id PS-42
```

## Notes

- You are given the ticket's shorthand (e.g. `PS-42`); pass it to `--id` and the command resolves it to the stored ticket.
