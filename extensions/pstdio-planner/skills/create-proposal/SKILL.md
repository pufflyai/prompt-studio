---
name: create-proposal
description: "Create a proposal ticket. Use for new features, large refactors, breaking API or schema changes, architecture changes, security changes, or when the user asks to save a plan as a proposal. Do not use for bug fixes, wording-only changes, non-breaking dependency updates, configuration changes, or tests for existing behavior."
metadata:
  version: 0.0.4
---

A proposal is a Planner ticket built from the `proposal` template. Use the `pst tickets` commands to create and edit it.

## Workflow

1. Derive a short, verb-led title from the request, such as `add-`, `update-`, `remove-`, `refactor-`, or `fix-`.
2. Confirm the `proposal` template exists with `pst tickets templates`.
3. Run `pst tickets write --title "<title>"`. This creates `.pstdio/tickets/<shorthand>/ticket.md`.
4. Run `pst tickets apply-template --id <shorthand> --template proposal` to apply the template.
5. Read the relevant code and documentation before editing the ticket. Record concrete findings that a reviewer can check.
6. Complete every applicable template section. Use specific, testable statements. Mark unanswered questions with `[MISSING INFORMATION]`.
7. Create each supporting file required by the table below. Fill it with findings from the research, not placeholders.
8. If no supporting file applies, add a short "Supporting resources" section that explains why `ticket.md` is enough.
9. Run `pst tickets save --id <shorthand>` to save the body and supporting files.

## Ticket files

Put planning material in `.pstdio/tickets/<shorthand>/files/<name>`. The next `pst tickets save` attaches the file to the ticket. Put implementation, test, validation, and review evidence in workspace reports instead.

- Create a file as soon as one trigger matches. Do not ask first.
- Keep each file focused. Do not put every detail in `ticket.md`.
- Skip a matching file only when research found nothing useful for it. Record the reason in the proposal.

| Resource                   | Create when                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `research.md`              | The proposal depends on external systems, libraries, unfamiliar behavior, prior art, logs, or repo investigation beyond the obvious.    |
| `contracts.md`             | The change touches HTTP APIs, SDK APIs, CLI commands, extension hooks, events, storage interfaces, or any caller/callee contract.       |
| `schemas.md`               | The change touches DB tables, migrations, config/frontmatter shapes, persisted files, validation schemas, or API payload schemas.       |
| `architecture-overview.md` | The proposal crosses package/runtime boundaries, introduces a subsystem, changes ownership boundaries, or needs a system map.           |
| `cookbook.md`              | Users, integrators, or future agents will need a concrete usage recipe for a public API, SDK, CLI, workflow, or operational process.    |
| `adr.md`                   | The proposal makes a lasting architectural decision, changes security/auth patterns, changes package boundaries, or chooses a tradeoff. |

## Finish condition

Stop after saving the proposal. Do not implement it.
