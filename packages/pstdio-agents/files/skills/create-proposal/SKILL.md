---
name: create-proposal
description: "Create a proposal ticket. Use this when asked to write a proposal, introduce changes that add features, large refactors, introduce breaking API or schema changes, modify architecture or design patterns, update security patterns, or to save a plan as proposal. Do not create proposals for bug fixes that restore intended behavior, typos or formatting/comment-only changes, non-breaking dependency updates, configuration-only changes, or tests that validate existing behavior."
---

## Workflow

1. Derive a concise, verb-led `title` from the request (kebab-case: `add-`, `update-`, `remove-`, `refactor-`, `fix-`).
2. Run `pstdio tickets write --title "<title>" --user-prompt "<user prompt verbatim>" --status "backlog" --template "proposal"` to create a proposal.
3. Update the proposal with concrete, testable statements.
4. Identify touch points throughout the project and track them in the proposal sections.
5. Track missing information with [MISSING INFORMATION] tags in the ticket.
6. (OPTIONAL) If the change affects a public surface (API, SDK, CLI), run `pstdio templates write --name "cookbook" --target "<ticket-id>"` to scaffold `cookbook.md`.
7. (OPTIONAL) If implementing the change requires knowledge of an API, DB schema, etc., encode this in a `contracts.md` or `schemas.md` file in the ticket folder.
8. (OPTIONAL) For complex tickets requiring deep understanding of the system, track relevant additional information in a `research.md` file in the ticket folder.
9. (OPTIONAL) For decisions with lasting architectural impact or important tradeoffs, run `pstdio templates write --name "adr" --target "<ticket-id>"` to scaffold `adr.md`.
10. Run `pstdio tickets save --id "<ticket-id>"` to persist the proposal.

## Output Locations

- Proposal: `.pstdio/tickets/<ticket-id>_<slug>/ticket.md`
- (OPTIONAL) Cookbook: `.pstdio/tickets/<ticket-id>_<slug>/cookbook.md`
- (OPTIONAL) Schemas: `.pstdio/tickets/<ticket-id>_<slug>/schemas.md`
- (OPTIONAL) Contracts: `.pstdio/tickets/<ticket-id>_<slug>/contracts.md`
- (OPTIONAL) Research: `.pstdio/tickets/<ticket-id>_<slug>/research.md`
- (OPTIONAL) ADR: `.pstdio/tickets/<ticket-id>_<slug>/adr.md`

## Notes

- **Do not start the implementation**. Stop after the proposal content is saved.
