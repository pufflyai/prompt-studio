---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  version: 0.0.2
---

Sub-tickets are planner tickets linked to a parent. Create them like any ticket (see create-ticket) with `--parent` set.

## Workflow

1. **Identify the parent.** You are given the parent ticket's shorthand (e.g. `PS-12`). Pass it to `--id` / `--parent` — commands resolve it.
2. **Read the parent body:** `pst tickets view --id <parent>`. Derive sub-tickets that are each:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Cover one system — split anything that spans multiple systems or large scopes.
3. **Create each sub-ticket** with the parent linked: `pst tickets write --title "<title>" --parent <parent-shorthand>`, then fill `.pstdio/tickets/<shorthand>/ticket.md` and `pst tickets save --id <shorthand>`.
4. **Write each child's body** to the same standard as create-ticket: concrete files/modules, how the work is validated and the commands to run it (where the repo has tests), recorded assumptions, `parallelizable` and `depends_on` set. Apply a template with `pst templates write --name <template> --ticket <shorthand>` if useful (`pst templates list` for available ones). Priority/type are tags (`--tags` from `pst tags list`), not body sections.
5. **Resolve blockers.** Check non-done tickets with `pst tickets list`. If a child depends on another ticket, record it in `depends_on` and set the blocked status when applicable.
6. **Stop after the sub-tickets are saved.** Do not implement code or touch unrelated tickets.

## Example

```bash
pst tickets write --title "Add upload retry config schema" --parent PS-12
pst tickets save --id PS-43
```

## Notes

- `pst tickets list --parent PS-12` lists the children of a parent.
