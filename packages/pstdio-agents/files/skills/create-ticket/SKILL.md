---
name: create-ticket
description: "Create a new ticket when the user asks to create a ticket or requests changes unrelated to an existing ticket. Always start by creating the ticket via the pstdio CLI."
---

## User Input

```text
$ARGUMENTS
```

## Workflow

1. Decide the ticket status:
   - If the user explicitly asked to create a ticket, set status to `backlog`.
   - Otherwise set status to `wip`.
2. Derive a concise, verb-led ticket title from the user request and immediately run the pstdio CLI to create the ticket.
   - Run `pstdio tickets write --title "<ticket title>" --user-prompt "<user prompt verbatim>" --status "<status>"`.
3. Fill the ticket template with concrete details:
   - Priority (P1/P2/P3)
   - Parallelizable (yes/no)
   - Goal, scope, steps, acceptance, and evidence
   - References to existing docs/specs (if any), otherwise record gaps as assumptions
   - Implementation Notes with key files/modules and decisions
   - Acceptance with explicit tests, file paths, and exact commands
   - Documentation updates, or an explicit “no docs” note
   - If blocked, run `pstdio tickets update --id "<ticket-id>" --status blocked` and document the reason in the ticket's `blocked_reason` frontmatter field
4. When defining acceptance, list the exact test file paths, cases covered, and commands to run. Tests must live in the same ticket as the feature/bugfix work. Do not create standalone “add tests” tickets. Tests belong with the functional change they validate.
5. Resolve blockers by checking all existing tickets that are not done. If another ticket is a blocker, add it to `depends_on` in frontmatter.
6. Run `pstdio tickets save --id "<ticket id>"` to persist the updated ticket content.
7. If the user only asked to create the ticket, stop after the ticket file(s) are created and saved and do not implement it. Otherwise start the ticket implementation and follow instructions in the implement-ticket skill.

## Output Locations

- Tickets: `.pstdio/tickets/<ticket-id>_<slug>/ticket.md`
- Supporting Files: `.pstdio/tickets/<ticket-id>_<slug>/files/`
- Validation Artifacts: `.pstdio/tickets/<ticket-id>_<slug>/artifacts/`
