---
name: implement-ticket
description: "Implement a single ticket end-to-end: locate the ticket file by id, then update its status (`review`, `wip`, `blocked`) via CLI. Use when asked to implement or complete a ticket."
---

## User Input

```text
$ARGUMENTS
```

## Ticket Implement Modes

## Workflow

1. (Optional) If no ticket description is provided:
   - If `next` / `continue`: run `pstdio tickets list --status ready`, then pull the first ticket by id.
   - If valid id: run `pstdio tickets pull --id <shorthand>`.
   - If the ticket is missing, ask the user to confirm the ticket id or `next`.
2. Update the ticket status
   - When starting work, run: `pstdio tickets update --id "<ticket-id>" --status wip`.
   - If blocked: run `pstdio tickets update --id "<ticket-id>" --status blocked` and document the reason in the ticket's `blocked_reason` frontmatter field, then stop the workflow.
   - If complete: after confirming all checklists are checked, run `pstdio tickets update --id "<ticket-id>" --status review`.
3. Update ticket checklists as you go
   - Check off `## Steps` only when:
     - A test exists that covers it, and
     - Tests pass, and
     - Any required refactor is done.
   - Check off `## Acceptance` only when:
     - There’s test coverage for it, and
     - The full test suite is green.
4. Evidence
   - Store artifacts under `.pstdio/tickets/<ticket-id>_<slug>/artifacts/`
   - If tests/commands can’t be run, record why in the ticket's `blocked_reason` frontmatter field.
5. Finish
   - Confirm everything in `## Steps` and `## Acceptance` is checked.
   - If the ticket is not completed due to errors, run `pstdio tickets update --id "<ticket-id>" --status blocked`, document the reason in the ticket's `blocked_reason` frontmatter field, then run `pstdio tickets save --id "<ticket-id>"`.
   - If the ticket is completed, run `pstdio tickets update --id "<ticket-id>" --status review`.
   - Commit the implementation changes before handing off, including ticket updates and evidence references.
   - Report completed files and artifacts.

## Validation

To be considered complete and ready for review, a ticket should provide Validation Artifacts. Validation Artifacts are **verifiable outputs** produced while doing the ticket e.g. by running `<validation-command> > validation.log 2>&1`

Agents should dump and review artifacts, including:

- Test, Build and Run outputs
- Walkthroughs
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any files needed to prove the ticket is implemented correctly

Artifacts **must** be:

- Concrete
- Inspectable
- Reproducible
- Referenced as evidence in the ticket

## Output Locations

- Tickets: `.pstdio/tickets/<ticket-id>_<slug>/ticket.md`
- Supporting Files: `.pstdio/tickets/<ticket-id>_<slug>/files/`
- Validation Artifacts: `.pstdio/tickets/<ticket-id>_<slug>/artifacts/`
