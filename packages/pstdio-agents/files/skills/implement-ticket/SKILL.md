---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  - version: 0.0.1
---

## Workflow

1. (Optional) Identify the target ticket shorthand from the user request (e.g. `PS-12`):
   - If `next` / `continue` is requested: run `pstdio tickets list --status ready`, then pull the first ticket by id.
   - If valid shorthand: run `pstdio tickets pull --id <shorthand>`.
   - If the ticket is missing, ask the user to confirm the ticket id or `next`.
2. Update the workspace status
   - Before starting work, run: `pstdio workspaces set-status --status running`.
   - The workspace is auto-detected from the current branch. Ticket status is derived automatically via hooks — do not set it directly.
3. Update ticket checklists as you go
4. Evidence
   - Store artifacts under `.pstdio/tickets/<ticket-id>_<slug>/artifacts/`
   - If tests/commands can’t be run, record why in the ticket’s `blocked_reason` frontmatter field.
5. Finish
   - Confirm everything is checked.
   - If the ticket is not completed, run `pstdio workspaces set-status --status blocked`.
   - If the ticket is completed, run `pstdio workspaces set-status --status review-ready`.

## Validation

To be considered complete and ready for review, a ticket should provide "Validation Artifacts": **verifiable outputs** produced while doing the ticket e.g. by running `<validation-command> > .pstdio/tickets/<ticket-id>_<slug>/artifacts/<artifact> 2>&1`

Validation Artifacts include:

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
