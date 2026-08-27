---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  version: 0.0.3
---

Sub-tickets are planner tickets linked to a parent. Create them like any ticket (see create-ticket) with `--parent` set.

## Workflow

1. Identify the parent ticket. Pass its shorthand, such as `PS-12`, to `--id` or `--parent`.
2. Read it with `pst tickets panel --id <parent>`. Split the work into sub-tickets that are:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Limited to one system. Split work that crosses systems or has a large scope.
3. Create each sub-ticket with `pst tickets write --title "<title>" --parent <parent-shorthand>`.
4. Fill `.pstdio/tickets/<shorthand>/ticket.md`. Follow the `create-ticket` standard. Name the files or modules involved, the validation commands, assumptions, `parallelizable`, and `depends_on`.
5. Apply a template when it helps. List templates with `pst tickets templates`, then run `pst tickets apply-template --id <shorthand> --template <template>`. Priority and type belong in tags from `pst tags list`, not in body sections.
6. Check unfinished tickets with `pst tickets list`. If another ticket blocks a child, add it to `depends_on` and use the project's blocked status.
7. Save each child with `pst tickets save --id <shorthand>`.
8. Stop after saving the sub-tickets. Do not implement them or edit unrelated tickets.

## Example

```bash
pst tickets write --title "Add upload retry config schema" --parent PS-12
pst tickets save --id PS-43
```

## Reference

`pst tickets list --parent PS-12` lists a ticket's children.
