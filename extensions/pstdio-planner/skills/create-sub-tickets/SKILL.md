---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. Identify the parent planner ticket from the user request or session variables.
   - Planner sessions pass the internal ticket resource id as `ticket`.
   - The display shorthand (for example `T-12`) is not necessarily the storage id.
   - Extract any requested ticket template slug.
2. Load the parent through the host-provided planner resource context or the `pstdio-planner.get-ticket` command when available.
3. Read the parent ticket body and derive sub-tickets. Each sub-ticket should be:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Include `Implementation Notes` covering assumptions, key decisions, and where to look in code.
   - Include `Acceptance` criteria with explicit tests (file paths, cases covered) and exact commands to run.
   - Include corresponding documentation updates.
4. Create each sub-ticket through the planner resource flow when available: dashboard create modal, command palette, or host-provided `pstdio-planner.create-ticket` command with `parentId` set to the parent ticket id.
5. Fill each child ticket body with concrete details. Use information from researching the codebase and documentation:
   - Priority (P1/P2/P3)
   - Parallelizable (yes/no)
   - References to existing docs (if any), otherwise record gaps as assumptions
   - Implementation Notes with key files/modules and decisions
   - Acceptance with explicit tests, file paths, and exact commands
   - Documentation updates, or an explicit “no docs” note
   - Track missing information with [MISSING INFORMATION] tags in the ticket.
6. When defining acceptance, list the test file paths, cases covered, and commands to run. Tests belong with the functional change they validate, do not create standalone “add tests” tickets.
7. Resolve blockers by checking existing non-done planner tickets. If another ticket blocks a child ticket, record that relationship in the child body and set planner blocker fields/status when available.
8. Stop after the sub-ticket resources are created. Do not implement code or modify unrelated plan artifacts.

## Output Locations

- Parent planner ticket: `pstdio-planner` extension ticket resource
- Sub-tickets: child `pstdio-planner` extension ticket resources
- Legacy CLI tickets, only when explicitly requested: `.pstdio/tickets/<shorthand>/ticket.md`

## Ticket Notes

- Split sub-tickets that span multiple systems or large scopes.
- Record assumptions in Implementation Notes when key details are missing.
