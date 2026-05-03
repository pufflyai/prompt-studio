---
name: create-proposal
description: "Create a proposal ticket. Use this when asked to write a proposal, introduce changes that add features, large refactors, introduce breaking API or schema changes, modify architecture or design patterns, update security patterns, or to save a plan as proposal. Do not create proposals for bug fixes that restore intended behavior, typos or formatting/comment-only changes, non-breaking dependency updates, configuration-only changes, or tests that validate existing behavior."
metadata:
  - version: 0.0.2
---

## Workflow

1. Derive a concise, verb-led `title` from the request (kebab-case: `add-`, `update-`, `remove-`, `refactor-`, `fix-`).
2. Run `pstdio tickets write --title "<title>" --user-prompt "<user prompt verbatim>" --status "backlog" --template "proposal"` to create a proposal.
3. Research the relevant codebase and documentation before editing the proposal. Gather enough concrete context to make the proposal reviewable.
4. Update the proposal with concrete, testable statements.
5. Identify touch points throughout the project and track them in the proposal sections.
6. Track missing information with [MISSING INFORMATION] tags in the ticket.
7. Create every supporting resource whose trigger applies. Supporting resources are part of the proposal, not optional polish.
8. Fill each supporting resource with the relevant findings. Do not leave placeholder-only files.
9. If no supporting resources apply, add a short "Supporting Resources" note in the proposal explaining why the proposal only needs `ticket.md`.
10. Run `pstdio tickets save --id "<shorthand>"` to persist the proposal and supporting files.

## Supporting Resource Rules

- Create a resource as soon as one trigger matches. Do not ask for permission first.
- Prefer one focused resource over putting every detail in `ticket.md`.
- Skip a matching resource only when it would be empty after research. Record the reason in the proposal.
- Use `.pstdio/tickets/<shorthand>/files/` for supporting resources.

| Resource                   | Create When                                                                                                                                               | Command                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `research.md`              | The proposal depends on external systems, libraries, unfamiliar behavior, prior art, logs, or repo investigation beyond the obvious touch points.         | `pstdio templates write --name "research" --target ".pstdio/tickets/<shorthand>/files/research.md"`                           |
| `contracts.md`             | The change touches HTTP APIs, SDK APIs, CLI commands, plugin hooks, events, storage interfaces, or any caller/callee contract.                            | `pstdio templates write --name "contracts" --target ".pstdio/tickets/<shorthand>/files/contracts.md"`                         |
| `schemas.md`               | The change touches DB tables, migrations, config/frontmatter shapes, persisted files, validation schemas, or API payload schemas.                         | `pstdio templates write --name "schemas" --target ".pstdio/tickets/<shorthand>/files/schemas.md"`                             |
| `architecture-overview.md` | The proposal crosses package/runtime boundaries, introduces a subsystem, changes ownership boundaries, or needs a system map for reviewers.               | `pstdio templates write --name "architecture-overview" --target ".pstdio/tickets/<shorthand>/files/architecture-overview.md"` |
| `cookbook.md`              | Users, integrators, or future agents will need a concrete usage recipe for a public API, SDK, CLI, workflow, or operational process.                      | `pstdio templates write --name "cookbook" --target ".pstdio/tickets/<shorthand>/files/cookbook.md"`                           |
| `adr.md`                   | The proposal makes a lasting architectural decision, changes security/auth patterns, changes package boundaries, or chooses between meaningful tradeoffs. | `pstdio templates write --name "adr" --target ".pstdio/tickets/<shorthand>/files/adr.md"`                                     |

## Output Locations

- Proposal: `.pstdio/tickets/<shorthand>/ticket.md`
- Cookbook: `.pstdio/tickets/<shorthand>/files/cookbook.md`
- Schemas: `.pstdio/tickets/<shorthand>/files/schemas.md`
- Contracts: `.pstdio/tickets/<shorthand>/files/contracts.md`
- Research: `.pstdio/tickets/<shorthand>/files/research.md`
- Architecture overview: `.pstdio/tickets/<shorthand>/files/architecture-overview.md`
- ADR: `.pstdio/tickets/<shorthand>/files/adr.md`

## Notes

- **Do not start the implementation**. Stop after the proposal content is saved.
