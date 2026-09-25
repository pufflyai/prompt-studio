---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  version: 0.0.13
---

Implement Planner tickets in a Prompt Studio workspace. Produce a committed revision and a change request report. Submit both when the workspace has a managed attempt.

## Workspace

Always work in a Prompt Studio workspace. Never use `git worktree add` or your agent's own worktree tool. Prompt Studio does not track those, so the ticket, reports, reviews and merges cannot find the work.

- If you run inside a workspace from `pst pstdio-planner run-attempt`, work there.
- When asked to implement tickets in a worktree, run `pst workspaces create`. It prints the workspace shorthand and path. Link each ticket with `pst tickets link --id <ticket> --workspace <workspace>`, then work at the printed path.
- For several tickets in one workspace, create one workspace and link every ticket to it.
- For one workspace per ticket, create and link a workspace for each ticket.

Only a `run-attempt` workspace has a managed attempt. In any other workspace, skip step 5. Give the user the workspace shorthand, commit SHA and report ID instead.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`. If it is missing or ambiguous, ask the user to confirm it.
   - For "implement the next ticket", list tickets in the project's ready status with `pst tickets list --status <ready-status>`. Use `pst statuses list` to find the status name.
   - Read the full body with `pst tickets panel --id <shorthand>` before changing code.
2. Implement only the ticket's scope. Follow the repository's contributor rules.
3. Run the required validation and commit the finished change in the workspace.
4. Create the change request report described below.
5. Keep the `reportId` returned by `pst reports save`. Read the commit SHA with `git rev-parse HEAD`, then run:
   - `pst pstdio-planner submit-change-request --workspace-id <workspace-id> --head-sha <head-sha> --change-request-report-id <report-id> --expected-attempt-state implementing`
   - After requested changes, use `changes_requested` as the expected state.
6. Do not update the ticket status. The Planner derives it from managed attempts and review verdicts.

## Change request report

The report must explain the change and include outputs that a reviewer can inspect.

1. Run `pst reports write --kind change_request --name change_request --template change-request` and keep the returned `name`, `path`, and `filesPath`.
2. Explain why the change is needed and why you chose the implementation.
3. Link the ticket, relevant code, documentation, ADRs, designs, and other useful resources.
4. Always state anything left undone, any shortcuts taken, and any blockers encountered. Write `None` when a section has nothing to report.
5. Explain how to validate the change. Add command outputs, screenshots, logs, or traces under the returned `filesPath`.
6. Complete the report at the returned `path`.
7. Run `pst reports save --name <returned-name>` and keep its `reportId` for revision submission.

Report creation never overwrites an existing report. When the base file exists, the command returns a numbered report such as `change_request_01` at `.pstdio/reports/change_request/report_01.md`.

Only an independent reviewer creates a review report. The implementation agent uses a change request report.

Report evidence includes:

- Test, build, and run outputs
- Walkthroughs of the change
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any file needed to prove the ticket is implemented correctly

Use concrete artifacts that another person or agent can inspect and reproduce.
