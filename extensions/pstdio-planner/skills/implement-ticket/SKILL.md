---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  version: 0.0.5
---

Implement planner tickets inside a workspace (a git worktree). Report progress through the workspace's attempt status, not by editing the ticket status directly.

## Workflow

1. **Identify the ticket.** You are given the ticket's shorthand (e.g. `PS-12`). Pass it to `--id` — commands resolve it. If the ticket is missing or ambiguous, ask the user to confirm it.
   - For "implement the next ticket", pick the first ready ticket: `pst tickets list --status <ready-status>` (see `pst statuses list` for the project's status names).
   - Read the full ticket body first: `pst tickets view --id <shorthand>`.
2. **Implement the change**, scoped to the ticket, following the host repo's own contributor conventions (its build, test, and style rules).
3. **Produce Validation Artifacts** (see below) that prove the work is correct.
4. **Report status on the workspace, not the ticket:**
   - Done and ready for review: `pst workspaces set-status --status review-ready`.
   - Blocked: `pst workspaces set-status --status blocked`.
   - Pass `--session-id <id>` when you have it, so post-attempt-status hooks correlate.
   - Do **not** run `pst tickets update --status` during or after implementation — the workspace status drives the ticket transition.

## Validation Artifacts

To be review-ready a ticket must produce **verifiable outputs** generated while doing the work. Capture them as files and attach the important ones to the ticket: write them under `.pstdio/tickets/<shorthand>/files/` and run `pst tickets save --id <shorthand>`.

Artifacts include:

- Test, build, and run outputs (e.g. `<repo's test/build command> > .pstdio/tickets/<shorthand>/files/build.log 2>&1`)
- Walkthroughs of the change
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any file needed to prove the ticket is implemented correctly

Artifacts **must** be concrete, inspectable, and reproducible.
