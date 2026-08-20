---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  version: 0.0.3
---

Refine a Planner ticket by adding researched detail and applying a template when useful.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`.
2. Run `pst tickets pull --id <shorthand>`. This writes `.pstdio/tickets/<shorthand>/ticket.md`. Without `--force`, it preserves existing local edits. Read the current body before changing it.
3. If the user requested a template, confirm it exists with `pst templates list`, then run `pst templates write --name <template> --ticket <shorthand>`. Keep useful existing content and remove placeholders that do not apply.
4. Research the code and documentation. Add the missing detail needed for implementation:
   - References, scope, implementation notes with the real files/modules to touch.
   - Implementation steps in the order to do them.
   - Acceptance criteria and the commands that validate them when tests exist.
   - `parallelizable` and `depends_on` in frontmatter. Priority and type stay in tags.
5. Save the ticket with `pst tickets save --id <shorthand>`.
6. Mark a proposal ready for review with `pst tickets proposal-refined --id <shorthand>`.
7. Stop after refinement. Do not implement code unless the user asked for it.

## Status

Refinement does not change ticket status. Run `pst tickets update --status` only when the user asks for a status change.
