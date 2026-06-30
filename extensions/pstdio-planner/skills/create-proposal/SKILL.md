---
name: create-proposal
description: "Create a proposal ticket. Use this when asked to write a proposal, introduce changes that add features, large refactors, introduce breaking API or schema changes, modify architecture or design patterns, update security patterns, or to save a plan as proposal. Do not create proposals for bug fixes that restore intended behavior, typos or formatting/comment-only changes, non-breaking dependency updates, configuration-only changes, or tests that validate existing behavior."
metadata:
  version: 0.0.3
---

A proposal is a planner ticket built from the `proposal` template. Create and edit it with the `pst tickets …` CLI.

## Workflow

1. Derive a concise, verb-led `title` from the request (`add-`, `update-`, `remove-`, `refactor-`, `fix-`).
2. Create the proposal ticket from the `proposal` template (confirm its name with `pst templates list`):
   - `pst tickets write --title "<title>"` to create the draft and lay down `.pstdio/tickets/<shorthand>/ticket.md`.
   - `pst templates write --name proposal --ticket <shorthand>` to apply the template to that file.
3. Research the codebase and docs before editing. Gather enough concrete context to make the proposal reviewable.
4. Fill every section the proposal template provides — typically why, goals / non-goals, acceptance scenarios, implementation outline, change touch points, assumptions, and risks — with concrete, testable statements. Track open questions with `[MISSING INFORMATION]`.
5. Create every supporting resource whose trigger applies (see table). Supporting resources are part of the proposal, not optional polish — fill them with real findings, not placeholders.
6. If no supporting resource applies, add a short "Supporting Resources" note in the proposal explaining why `ticket.md` is enough.
7. Save the proposal: `pst tickets save --id <shorthand>` (reconciles the body and supporting files into the store).

## Ticket files

Ticket files are planning resources for a ticket. Create one in `.pstdio/tickets/<shorthand>/files/<name>` and it is attached to the ticket on the next `pst tickets save`. Use workspace reports, not ticket files, for agent-produced review, validation, test, or implementation evidence.

- Create a resource as soon as one trigger matches — do not ask first.
- Prefer one focused resource over piling every detail into `ticket.md`.
- Skip a matching resource only when it would be empty after research, and record why in the proposal.

| Resource                   | Create When                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `research.md`              | The proposal depends on external systems, libraries, unfamiliar behavior, prior art, logs, or repo investigation beyond the obvious.    |
| `contracts.md`             | The change touches HTTP APIs, SDK APIs, CLI commands, extension hooks, events, storage interfaces, or any caller/callee contract.       |
| `schemas.md`               | The change touches DB tables, migrations, config/frontmatter shapes, persisted files, validation schemas, or API payload schemas.       |
| `architecture-overview.md` | The proposal crosses package/runtime boundaries, introduces a subsystem, changes ownership boundaries, or needs a system map.           |
| `cookbook.md`              | Users, integrators, or future agents will need a concrete usage recipe for a public API, SDK, CLI, workflow, or operational process.    |
| `adr.md`                   | The proposal makes a lasting architectural decision, changes security/auth patterns, changes package boundaries, or chooses a tradeoff. |

## Notes

- **Do not start the implementation.** Stop after the proposal content is saved.
