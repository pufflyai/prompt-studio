---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Identify the parent ticket shorthand from the user request as well as possible templates.
2. Load the parent ticket locally:
   - Run `pstdio tickets pull --id "<parent-ticket-id>"`.
3. Read the parent ticket and derive sub-tickets. Each sub-ticket should be:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Include `Implementation Notes` covering assumptions, key decisions, and where to look in code.
   - Include `Acceptance` criteria with explicit tests (file paths, cases covered) and exact commands to run.
   - Include corresponding documentation updates.
4. Create each sub-ticket via the CLI (one command per sub-ticket):
   - Run `pstdio tickets write --title "<ticket title>" --status "<status>" --parent-id "<parent-ticket-id>"`.
5. Fill the resulting tickets at `.pstdio/tickets/<ticket-id>_<slug>/ticket.md` with concrete details. Use information from researching the codebase and documentation:
   - Priority (P1/P2/P3)
   - Parallelizable (yes/no)
   - References to existing docs (if any), otherwise record gaps as assumptions
   - Implementation Notes with key files/modules and decisions
   - Acceptance with explicit tests, file paths, and exact commands
   - Documentation updates, or an explicit “no docs” note
   - Track missing information with [MISSING INFORMATION] tags in the ticket.
6. When defining acceptance, list the test file paths, cases covered, and commands to run. Tests belong with the functional change they validate, do not create standalone “add tests” tickets.
7. Resolve blockers by checking all existing tickets that are not done. If another ticket is a blocker, add it to `depends_on` in frontmatter.
   - If blocked, run `pstdio tickets update --id "<ticket-id>" --status blocked`
8. Run `pstdio tickets save --id "<ticket id>"` to persist the updated ticket content.
9. Stop after the sub-ticket files are created. Do not implement code or modify plan artifacts.

## Output Locations

- Parent Ticket: `.pstdio/tickets/<parent-ticket-id>_<slug>/ticket.md`
- Sub-tickets: `.pstdio/tickets/<ticket-id>_<slug>/ticket.md`

## Ticket Notes

- Split sub-tickets that span multiple systems or large scopes.
- Record assumptions in Implementation Notes when key details are missing.
