---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  version: 0.0.10
---

Implement planner tickets inside a workspace (a git worktree). Report implementation progress on the ticket itself; workspace attempt statuses no longer exist.

## Workflow

1. **Identify the ticket.** You are given the ticket's shorthand (e.g. `PS-12`). Pass it to `--id` — commands resolve it. If the ticket is missing or ambiguous, ask the user to confirm it.
   - For "implement the next ticket", pick the first ready ticket: `pst tickets list --status <ready-status>` (see `pst statuses list` for the project's status names).
   - Read the full ticket body first: `pst tickets view --id <shorthand>`.
2. **Move the ticket into implementation.**
   - Run `pst statuses list` because status names are project-configurable.
   - Move the ticket to the configured in-progress status with `pst tickets update --id <shorthand> --status "<status>"` unless it is already there.
3. **Implement the change**, scoped to the ticket, following the host repo's own contributor conventions (its build, test, and style rules).
4. **Produce a change request report** (see below) that explains the work and proves it is correct.
5. **Update the ticket status before finishing:**
   - Done and ready for review: move the ticket to the configured review status (the default is `In Review`).
   - Blocked: move the ticket to the configured blocked status and include `--blocked-reason "<reason>"`.
   - Use `pst tickets update --id <shorthand> --status "<status>"`; workspace-level attempt status commands are obsolete.
6. **Attach the review link when you open one.** If you create a pull request or merge request for the ticket, run `pst tickets link-review --id <shorthand> --url <review-url>`.

## Change Request Report

To be review-ready a ticket must explain the implemented change and include **verifiable outputs** generated while doing the work. Capture them in a workspace change request report so an independent reviewer can inspect the decisions and proof alongside the implementation:

1. Run `pst reports write --kind change_request --name change_request --template change-request` and keep the returned `name`, `path`, and `filesPath`.
2. Explain why the change is needed and motivate concrete implementation decisions.
3. Link the ticket, relevant code, documentation, ADRs, designs, and other useful resources.
4. Always state anything left undone, any shortcuts taken, and any blockers encountered. Write `None` when a section has nothing to report.
5. Explain how to validate the change. Add command outputs, screenshots, logs, or traces under the returned `filesPath`.
6. Complete the report at the returned `path`.
7. Run `pst reports save --name <returned-name>`.

Report creation never overwrites an existing report. When the base file exists, the command returns a numbered report such as `change_request_01` at `.pstdio/reports/change_request/report_01.md`.

Review reports are only for an independent third-party review of the change request. The implementation agent must not use a review report for its own handoff.

Report evidence includes:

- Test, build, and run outputs
- Walkthroughs of the change
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any file needed to prove the ticket is implemented correctly

Artifacts **must** be concrete, inspectable, and reproducible.
