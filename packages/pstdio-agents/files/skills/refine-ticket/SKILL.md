---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Identify the target ticket shorthand from the user request (e.g. `PS-12`).
   - If the request includes a template name (e.g. `refine ticket: PS-12 with template proposal`), extract the template slug. Default template is `ticket`.
2. Pull the ticket locally if not already present:
   - Run `pstdio tickets pull --id "<shorthand>"`.
3. Read the current `ticket.md` content and save a backup as `ticket.original.md` in the ticket folder.
4. Scaffold the template into the ticket:
   - Run `pstdio templates write --name "<template>" --ticket "<shorthand>"` to overwrite `ticket.md` with the template structure.
   - The `--name` value is a lowercase slug matching the template name (e.g. `ticket`, `proposal`).
5. Refine `ticket.md` by incorporating information from `ticket.original.md` into the template sections.
6. Add missing detail using repo/docs research so the ticket is implementation-ready:
   - Priority, parallelizable
   - Goal, references, scope, implementation notes
   - Steps aligned to Red/Green/Refactor
   - Acceptance criteria with explicit pass/fail conditions
   - Evidence expectations and exact validation commands
7. If the changes were successful, remove the original file and save your changes with `pstdio tickets save --id "<shorthand>"`.
8. Stop after refinement. Do not implement code changes unless explicitly asked.

## Output Locations

- Ticket: `.pstdio/tickets/<shorthand>/ticket.md`
