---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  version: 0.0.13
---

Implement Planner tickets in a Prompt Studio workspace. Produce a committed revision and a change request report, then follow the configured review and pull request steps.

## Workspace

Always work in a Prompt Studio workspace. When the user asks you to work in a worktree, create a Prompt Studio workspace with `pst workspaces create --provider pstdio.worktree`. It prints the workspace path. Work there. Do not use `git worktree add` or your agent's own worktree tool. Prompt Studio does not track those worktrees, so reports, reviews, and merges cannot find the work.

Only a workspace started by `pst pstdio-planner run-attempt --ticket <shorthand>` has a managed attempt. The Planner derives its ticket status from the attempt and review verdicts; do not set that status directly. In any other workspace, skip step 5, update the ticket status after fixing review findings, and give the user the workspace ID, commit SHA, and report ID.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`. If it is missing or ambiguous, ask the user to confirm it.
   - For "implement the next ticket", list tickets in the project's ready status with `pst tickets list --status <ready-status>`. Use `pst statuses list` to find the status name.
   - Read the full body with `pst tickets panel --id <shorthand>` before changing code.
   - Read the workflow options with `pst pstdio-planner implementation-policy`. `adversarialReview` and `openPr` are enabled by default and can be toggled in the current project's Planner settings. Explicit user instructions for this task take precedence.
2. Implement only the ticket's scope. Follow the repository's contributor rules.
3. Run the required validation, follow the adversarial review step below, and commit the finished change in the managed workspace.
4. Create the change request report described below.
5. Keep the `reportId` returned by `pst reports save`. Read the commit SHA with `git rev-parse HEAD`, then run:
   - `pst pstdio-planner submit-change-request --workspace-id <workspace-id> --head-sha <head-sha> --change-request-report-id <report-id> --expected-attempt-state implementing`
   - After requested changes, use `changes_requested` as the expected state.
6. Follow the completion steps below.

## Adversarial review

Read `pst pstdio-planner implementation-policy` again after implementation and validation. When `adversarialReview` is enabled, run an adversarial review automatically before the final commit and handoff. The setting controls this step; do not ask for confirmation. When disabled, skip the review unless the user explicitly requested it.

Use an independent reviewer when available. Fix the findings before handoff.

## Completion

Read `pst pstdio-planner implementation-policy` again before handoff so changes to the settings take effect.

- When `openPr` is enabled and validation has passed, push the implementation branch and open a draft PR against `defaultTargetBranch` from the policy, or the repository's default branch when unset. A value such as `origin/main` selects `main` on `origin`. Reuse an existing PR for that branch. Include the ticket shorthand, a summary, and validation results in the PR. Follow the repository's PR title rules. With GitHub CLI, use `gh pr create --draft --base <target-branch> --title <title> --body-file <path>`.
- Read the ticket's `reviewLinks` with `pst tickets panel --id <shorthand>`. If the PR URL is not already linked, run `pst tickets link-review --id <shorthand> --url <pr-url>`. Include the PR URL in the handoff. If pushing, creating, or linking the PR fails, report the blocker without claiming that step succeeded.
- When `openPr` is disabled, skip PR creation and linking unless the user requested them.

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
- Design documents or architecture diagrams
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any file needed to prove the ticket is implemented correctly

Use concrete artifacts that another person or agent can inspect and reproduce.
