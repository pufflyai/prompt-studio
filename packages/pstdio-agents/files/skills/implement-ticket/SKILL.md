---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  - version: 0.0.3
---

## Workflow

1. The ticket lives at `.pstdio/tickets/<shorthand>/ticket.md`.
   - If `next ticket` is requested: run `pstdio tickets list --status ready`, then pull the first ticket by id.
   - If the ticket is missing, try to pull the ticket `pstdio tickets pull --id <shorthand>` and if it doesn't exist, ask the user to confirm the ticket id.
2. Update ticket checklists as you go
3. Evidence
   - Store artifacts under `.pstdio/tickets/<shorthand>/artifacts/`
4. Finish
   - Confirm everything is checked.
   - If the ticket is not completed, run `pstdio workspaces set-status --status blocked`.
   - If the ticket is completed, run `pstdio workspaces set-status --status review-ready`.
   - Do not set ticket status directly with `pstdio tickets update` during or after implementation.

## Validation

To be considered complete and ready for review, a ticket should provide "Validation Artifacts": **verifiable outputs** produced while doing the ticket e.g. by running `<validation-command> > .pstdio/tickets/<shorthand>/artifacts/<artifact> 2>&1`

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

- Tickets: `.pstdio/tickets/<shorthand>/ticket.md`
- Supporting Files: `.pstdio/tickets/<shorthand>/files/`
- Validation Artifacts: `.pstdio/tickets/<shorthand>/artifacts/`
