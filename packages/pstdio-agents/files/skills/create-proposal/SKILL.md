---
name: create-proposal
description: "Create a proposal ticket. Use this when asked to write a proposal, introduce changes that add features, large refactors, introduce breaking API or schema changes, modify architecture or design patterns, update security patterns, or to save a plan as proposal. Do not create proposals for bug fixes that restore intended behavior, typos or formatting/comment-only changes, non-breaking dependency updates, configuration-only changes, or tests that validate existing behavior."
metadata:
  - version: 0.0.1
---

## Workflow

1. Derive a concise, verb-led `title` from the request (kebab-case: `add-`, `update-`, `remove-`, `refactor-`, `fix-`).
2. Run `pstdio tickets write --title "<title>" --user-prompt "<user prompt verbatim>" --status "backlog" --template "proposal"` to create a proposal.
3. Update the proposal with concrete, testable statements.
4. Identify touch points throughout the project and track them in the proposal sections.
5. Track missing information with [MISSING INFORMATION] tags in the ticket.
6. (OPTIONAL) If the change affects a public surface (API, SDK, CLI), run `pstdio templates write --name "cookbook" --target ".pstdio/tickets/<shorthand>/files/cookbook.md"` to scaffold `cookbook.md`.
7. (OPTIONAL) If implementing the change requires knowledge of an API, run `pstdio templates write --name "contracts" --target ".pstdio/tickets/<shorthand>/files/contracts.md"` to scaffold `contracts.md`. If it requires knowledge of a DB or data schema, run `pstdio templates write --name "schemas" --target ".pstdio/tickets/<shorthand>/files/schemas.md"` and document relevant schemas there.
8. (OPTIONAL) For proposals using external systems, libraries or requiring deep understanding of the system, run `pstdio templates write --name "research" --target ".pstdio/tickets/<shorthand>/files/research.md"` and document your research there.
9. (OPTIONAL) For decisions with lasting architectural impact or important tradeoffs, run `pstdio templates write --name "adr" --target ".pstdio/tickets/<shorthand>/files/adr.md"` to scaffold `adr.md`.
10. Run `pstdio tickets save --id "<shorthand>"` to persist the proposal.

## Output Locations

- Proposal: `.pstdio/tickets/<shorthand>/ticket.md`
- (OPTIONAL) Cookbook: `.pstdio/tickets/<shorthand>/files/cookbook.md`
- (OPTIONAL) Schemas: `.pstdio/tickets/<shorthand>/files/schemas.md`
- (OPTIONAL) Contracts: `.pstdio/tickets/<shorthand>/files/contracts.md`
- (OPTIONAL) Research: `.pstdio/tickets/<shorthand>/files/research.md`
- (OPTIONAL) ADR: `.pstdio/tickets/<shorthand>/files/adr.md`

## Notes

- **Do not start the implementation**. Stop after the proposal content is saved.
