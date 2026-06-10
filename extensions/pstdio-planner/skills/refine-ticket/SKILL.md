---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Identify the target planner ticket from the user request or session variables.
   - Planner sessions pass the internal ticket resource id as `ticket`.
   - The card shorthand (for example `PS-12`) is display text; do not assume it is the storage id.
   - If the request includes a template name (for example `refine ticket with template proposal`), extract the template slug. Default template is `ticket`.
2. Load the planner ticket through the host-provided planner resource context or the `pstdio-planner.get-ticket` command when available.
3. Preserve the original body in your notes before editing. Do not create `ticket.original.md` unless you are working on a legacy CLI ticket.
4. If a template was requested, use the ticket template as structure and merge the existing body into it. Keep useful content; remove placeholders that do not apply.
5. Add missing detail using repo/docs research so the ticket is implementation-ready:
   - Priority, parallelizable
   - Goal, references, scope, implementation notes
   - Steps aligned to Red/Green/Refactor
   - Acceptance criteria with explicit pass/fail conditions
   - Evidence expectations and exact validation commands
6. Save the updated body back to the planner ticket resource through the host-provided update flow. Do not run legacy `pst tickets save` for planner extension tickets.
7. Stop after refinement. Do not implement code changes unless explicitly asked.

## Output Locations

- Planner ticket body: `pstdio-planner` extension ticket resource
- Planner supporting files: ticket files attached to the planner ticket resource
- Legacy CLI ticket body, only when explicitly requested: `.pstdio/tickets/<shorthand>/ticket.md`
