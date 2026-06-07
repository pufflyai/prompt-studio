---
name: create-proposal
description: "Create a proposal ticket. Use this when asked to write a proposal, introduce changes that add features, large refactors, introduce breaking API or schema changes, modify architecture or design patterns, update security patterns, or to save a plan as proposal. Do not create proposals for bug fixes that restore intended behavior, typos or formatting/comment-only changes, non-breaking dependency updates, configuration-only changes, or tests that validate existing behavior."
metadata:
  - version: 0.0.2
---

## Workflow

1. Derive a concise, verb-led `title` from the request (kebab-case: `add-`, `update-`, `remove-`, `refactor-`, `fix-`).
2. Create a planner ticket using the proposal template when the planner resource flow is available: dashboard create modal, command palette, or host-provided `pstdio-planner.create-ticket` command.
3. Research the relevant codebase and documentation before editing the proposal. Gather enough concrete context to make the proposal reviewable.
4. Update the proposal with concrete, testable statements.
5. Identify touch points throughout the project and track them in the proposal sections.
6. Track missing information with [MISSING INFORMATION] tags in the ticket.
7. Create every supporting resource whose trigger applies. Supporting resources are part of the proposal, not optional polish.
8. Fill each supporting resource with the relevant findings. Do not leave placeholder-only files.
9. If no supporting resources apply, add a short "Supporting Resources" note in the proposal explaining why the proposal only needs `ticket.md`.
10. Save the updated proposal body and supporting files back to the planner ticket resource. Do not run legacy `pst tickets save` for planner extension tickets.

## Supporting Resource Rules

- Create a resource as soon as one trigger matches. Do not ask for permission first.
- Prefer one focused resource over putting every detail in `ticket.md`.
- Skip a matching resource only when it would be empty after research. Record the reason in the proposal.
- Use planner ticket files for supporting resources when the host exposes ticket file actions.
- Use `.pstdio/tickets/<shorthand>/files/` only for legacy CLI tickets explicitly requested by the user.

| Resource                   | Create When                                                                                                                                               | Command                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `research.md`              | The proposal depends on external systems, libraries, unfamiliar behavior, prior art, logs, or repo investigation beyond the obvious touch points.         | Create a planner ticket file named `research.md`.                                                                             |
| `contracts.md`             | The change touches HTTP APIs, SDK APIs, CLI commands, extension hooks, events, storage interfaces, or any caller/callee contract.                         | Create a planner ticket file named `contracts.md`.                                                                            |
| `schemas.md`               | The change touches DB tables, migrations, config/frontmatter shapes, persisted files, validation schemas, or API payload schemas.                         | Create a planner ticket file named `schemas.md`.                                                                              |
| `architecture-overview.md` | The proposal crosses package/runtime boundaries, introduces a subsystem, changes ownership boundaries, or needs a system map for reviewers.               | Create a planner ticket file named `architecture-overview.md`.                                                                |
| `cookbook.md`              | Users, integrators, or future agents will need a concrete usage recipe for a public API, SDK, CLI, workflow, or operational process.                      | Create a planner ticket file named `cookbook.md`.                                                                             |
| `adr.md`                   | The proposal makes a lasting architectural decision, changes security/auth patterns, changes package boundaries, or chooses between meaningful tradeoffs. | Create a planner ticket file named `adr.md`.                                                                                  |

## Output Locations

- Proposal: planner ticket body
- Supporting resources: planner ticket files
- Legacy CLI proposal, only when explicitly requested: `.pstdio/tickets/<shorthand>/ticket.md`

## Notes

- **Do not start the implementation**. Stop after the proposal content is saved.
