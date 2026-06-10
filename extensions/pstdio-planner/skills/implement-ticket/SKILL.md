---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  - version: 0.0.4
---

## Workflow

1. The ticket is a planner extension resource unless the user explicitly names a legacy CLI ticket.
   - Planner sessions pass the internal ticket resource id as `ticket`.
   - Display shorthand like `PS-12` is for humans; use the internal id when calling planner commands.
   - If `next ticket` is requested, use the planner board/list and choose the first ready ticket. Only use `pst tickets list --status ready` for legacy CLI tickets.
   - If the planner ticket cannot be loaded from session/resource context, ask the user to confirm the ticket id.
2. Evidence
   - Store artifacts in planner ticket files or attachments when the host exposes that flow.
   - For legacy CLI tickets only, store artifacts under `.pstdio/tickets/<shorthand>/artifacts/`.
3. Finish
   - If the ticket is not completed, run `pst workspaces set-status --status blocked`.
   - If the ticket is completed, run `pst workspaces set-status --status review-ready`.
   - Do not set ticket status directly with `pst tickets update` during or after implementation.

## Validation

To be considered complete and ready for review, a ticket should produce "Validation Artifacts": **verifiable outputs** generated while doing the ticket. For legacy CLI tickets, this can be a command like `<validation-command> > .pstdio/tickets/<shorthand>/artifacts/<artifact> 2>&1`. For planner extension tickets, attach or record equivalent artifacts through planner ticket files when available.

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

## Output Locations

- Planner tickets: `pstdio-planner` extension ticket resources
- Planner supporting files: ticket files attached to the planner ticket resource
- Legacy CLI tickets: `.pstdio/tickets/<shorthand>/ticket.md`
- Legacy CLI artifacts: `.pstdio/tickets/<shorthand>/artifacts/`
