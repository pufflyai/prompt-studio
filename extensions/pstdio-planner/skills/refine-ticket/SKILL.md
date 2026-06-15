---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  version: 0.0.2
---

Refining means making an existing planner ticket implementation-ready: adding researched detail and, optionally, reshaping it to a template.

## Workflow

1. **Identify the ticket.** You are given the ticket's shorthand (e.g. `PS-12`). Pass it to `--id`.
2. **Pull it to a local file to edit:** `pst tickets pull --id <shorthand>` writes `.pstdio/tickets/<shorthand>/ticket.md` (without `--force` it will not clobber existing local edits). Read the current body before changing it.
3. **If a template was requested** (e.g. "refine with template proposal"), confirm it exists with `pst templates list`, then apply it: `pst templates write --name <template> --ticket <shorthand>` and merge the existing content into the new structure — keep useful content, drop placeholders that do not apply.
4. **Add missing detail** from repo/docs research so the ticket is implementation-ready:
   - References, scope, implementation notes with the real files/modules to touch.
   - Implementation steps in the order to do them.
   - Acceptance the template asks for, with the commands to validate it (where the repo has tests).
   - Frontmatter: `parallelizable`, `depends_on`. Priority/type stay as tags.
5. **Save:** `pst tickets save --id <shorthand>`.
6. **Stop after refinement.** Do not implement code unless explicitly asked.

## Notes

- Refining never changes a ticket's status by itself — adjust status separately with `pst tickets update --status` only if asked.
