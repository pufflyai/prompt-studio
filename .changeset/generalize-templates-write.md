---
"pstdio": minor
---

`pstdio templates write` now accepts `--target <path>` to render a template to an arbitrary file path (relative to the current directory, parent dirs auto-created, existing files overwritten), and `--ticket <shorthand>` for the previous ticket-scoped behavior (writes `.pstdio/tickets/<shorthand>/ticket.md` and preserves the existing H1 title). Exactly one of the two flags is required. A repeatable `--var KEY=value` flag passes additional placeholders to the template. Breaking: callers that previously used `--target <ticket-shorthand>` must switch to `--ticket <shorthand>`.

Added bundled document templates `contracts`, `schemas`, and `research` for ticket-scoped API/schema/investigation notes, and updated the `create-proposal` skill to scaffold them with `pstdio templates write --target .pstdio/tickets/<shorthand>/<file>.md`.
