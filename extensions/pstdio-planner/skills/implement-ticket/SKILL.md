---
name: implement-ticket
description: "Implement a ticket end-to-end. Use when asked to implement or complete a ticket."
metadata:
  version: 0.0.20
---

Implement Planner tickets in a Prompt Studio workspace. Produce a committed revision and a change request report, then follow the configured review and pull request steps.

## Workspace

Always work in a Prompt Studio workspace. Never use `git worktree add` or your agent's own worktree tool. Prompt Studio does not track those, so the ticket, reports, reviews and merges cannot find the work.

- If you run inside a workspace from `pst pstdio-planner run-attempt`, work there.
- Before creating a workspace, read the ticket's linked workspaces with `pst tickets workspaces --id <ticket>` and their implementation owners with `pst pstdio-planner list-variants`.
- For a linked workspace without a managed variant, list its conversations with `pst sessions list --workspace-id <workspace-id>`. Read the relevant conversation and ticket to find the existing implementation session. Reuse that session for corrections. If ownership is unclear, clarify it before starting another writer.
- Corrections, review fixes, dependency repairs, and resumed work continue in the existing implementation conversation and workspace, including after submission or a passing review. The user does not need to request reuse. If another implementation session owns the workspace, send the task to that session with `pst sessions follow-up` instead of starting a competing writer. A queued follow-up does not transfer ownership.
- When a new workspace is needed, run `pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'`. It prints the workspace shorthand and path. Link each ticket with `pst tickets link --id <ticket> --workspace <workspace>`, then work at the printed path. Other workspace types use their own provider ID and declared parameters. See [Workspaces](https://prompt.studio/docs/references/cli/workspaces/).
- For several tickets in one workspace, create one workspace and link every ticket to it.
- For one workspace per ticket, create and link a workspace for each ticket.

Create another workspace only when no suitable linked workspace exists, for a useful implementation alternative, or for an explicit request. Workspaces identify variants; they do not own ticket progress. The responsible implementation agent coordinates variant evidence and updates the ticket. Reviewers and variant agents report evidence to it.

Only a workspace started by `pst pstdio-planner run-attempt --ticket <shorthand>` has a managed attempt. You own its ticket status; Planner does not set it for you. In any other workspace, skip revision submission in step 5 and include the workspace ID, commit SHA, and report ID in the handoff. See [Attempts](https://prompt.studio/docs/extensions/planner/attempts/#run-an-attempt) and [Who sets the ticket status](https://prompt.studio/docs/extensions/planner/attempts/#who-sets-the-ticket-status).

### Branches and dependency code

Your working branch, dependency base, and delivery target have different roles. Keep the working branch assigned to your workspace. The attempt's recorded base is the code your change builds on. The delivery target comes from the implementation policy; it is not a command to check out that branch or reset your workspace to it.

Before editing a managed attempt (see [Dependencies](https://prompt.studio/docs/extensions/planner/attempts/#dependencies) and [Updating a dependency stack](https://prompt.studio/docs/extensions/planner/attempts/#updating-a-dependency-stack)):

1. Read `pst pstdio-planner read-attempt-history --workspace-id <workspace-id>`. Keep the owner session ID, recorded base, and latest revision number.
2. Read the ticket's dependencies and inspect the required files in this workspace. A submitted prerequisite can exist only on its own branch. A completed ticket or an answered human request does not prove that its commits reached the target branch or your workspace.
3. For dependent work, verify the base with `pst pstdio-planner update-stack --workspace-id <workspace-id> --implementation-session-id <owner-session-id> --expected-head-sha <git-rev-parse-HEAD>`. Commit your existing changes first if the workspace is dirty. Planner combines compatible submitted dependency branches into a base and integrates it in this same workspace. Check its result and the required files before continuing.

Dependency integration is part of implementing this ticket. This assignment authorizes stack updates in your assigned workspace; run them without asking for another confirmation. It does not approve another ticket, merge into the project target, or complete a ticket. Do not recreate prerequisite code, create a replacement attempt, or use a completed status to bypass missing code. Reconcile Git conflicts yourself in this workspace: inspect both revisions, preserve their required behavior and your ticket's changes, resolve the files, commit the merge, and retry `update-stack`. Run the affected tests before submitting. Do not request human review or confirmation merely because Git reports conflicts. Ask only when features, concepts, requirements, plans, or architecture conflict and the existing instructions cannot decide the intended behavior. Explain that semantic conflict and the exact choice needed; a conflicting file alone is not a human decision.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`. If it is missing or ambiguous, ask the user to confirm it.
   - For "implement the next ticket", list tickets in the project's ready status with `pst tickets list --status <ready-status>`. Use `pst statuses list` and the workflow selections in `implementation-policy` to discover current status IDs and labels.
   - Read the full body with `pst tickets panel --id <shorthand>` before changing code.
   - Read the workflow options with `pst pstdio-planner implementation-policy`. `adversarialReview` and `openPr` are enabled by default and can be toggled in the current project's Planner settings; see [Implementation options](https://prompt.studio/docs/extensions/planner/#implementation-options). Explicit user instructions for this task take precedence.
   - Update the ticket by its discovered status ID when starting, blocking, resuming, handing off, and meeting the actual completion criteria. Use `pst tickets update --id <ticket> --status-id <status-id>`. Labels are presentation; do not assume English names or seeded IDs. An unconfigured optional convenience does not require repeated human requests. Clarify an unclear required project workflow through the existing human request mechanism.
2. Implement only the ticket's scope. Follow the repository's contributor rules and its own requirements documents. Prompt Studio's product requirements apply only when the repository is Prompt Studio. Before adding or changing UI, read `pst pstdio-planner refinement-policy`. When `updateCanvasDesign` is enabled and Canvas is available, follow the project's canvas skill and update the linked design first. Preserve unrelated designs and link exact preview names and source paths in the ticket. Canvas designs replace artifact prototypes. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. If the option is off, record why the design step was skipped. Resolve policy-read failures before implementation.
3. Run the required validation, follow the adversarial review step below, and commit the finished change in the managed workspace.
4. Create the change request report described below.
5. Keep the `reportId` returned by `pst reports save`. Read the commit SHA with `git rev-parse HEAD`, then run:
   - `pst pstdio-planner submit-revision --workspace-id <workspace-id> --implementation-session-id <owner-session-id> --head-sha <head-sha> --change-request-report-id <report-id> --expected-revision <last-revision-number>`
   - Read the owner session ID and last revision number with `pst pstdio-planner read-attempt-history --workspace-id <workspace-id>`. Use revision 0 before the first submission. Later corrections append revisions in the same workspace. Previous verdicts remain on their original commits; do not reopen or dismiss them to unlock submission.
   - Update the appropriate ticket handoff status. A handoff status does not request another managed reviewer. A completed status requires the task's actual delivery or acceptance, including latest-head CI and merge when required.
6. Follow the completion steps below.

## When stuck

When you cannot proceed without a person's decision or action, create a Planner review request. This records the blocker and sets Needs attention in the timeline. Do this before ending the turn. Do not only ask in chat or set a ticket status.

Use `pst pstdio-planner request-human` with the ticket, a short title, concrete instructions, and a task or decision request. See [Review requests](https://prompt.studio/docs/extensions/planner/review-requests/). Include what you tried, the evidence, and exactly what the person must decide or do.

```bash
pst pstdio-planner request-human --ticket PS-12 \
  --title "Confirm the missing requirement" \
  --instructions "The ticket allows two outcomes. Choose the required behavior before implementation continues." \
  --request '{"kind":"decision","questions":[{"id":"behavior","label":"Which behavior is required?","required":true,"input":{"kind":"text"}}]}'
```

For a concrete action that needs confirmation, use `--request '{"kind":"task"}'`. In a managed workspace, pass `--workspace-id <workspace-id>` and `--session-id <implementation-session-id>` so Planner can reuse the linked conversation. Set the ticket to its blocked status before pausing, and update it again before resumed implementation. A merge-only request uses `--affected-action merge`; other unresolved decisions block implementation. An optional status guard must use the value read from the latest record.

Keep the returned request ID. Stop work that depends on the answer. After the person answers, read `pst pstdio-planner review-requests read --request-id <request-id>`, verify the requested action or decision against the actual files and Git history, then resume. "Completion confirmed" records an answer; it does not integrate code. If the same blocker remains, inspect and repair the dependency base before requesting the same action again. Describe unchanged evidence clearly instead of treating repeated resumes as progress. Never answer your own request for the person. `run-review` is for reviewing code, not requesting human help.

## Adversarial review

Read `pst pstdio-planner implementation-policy` again after implementation and validation. When `adversarialReview` is enabled, run an adversarial review automatically before the final commit and handoff. The setting controls this step; do not ask for confirmation. When disabled, skip the review unless the user explicitly requested it.

Use an independent reviewer when available. Fix relevant findings before handoff. This is the normal review step. Do not launch `run-review` again merely to finish a Planner phase; use it only for an explicit additional review task. Review evidence never moves ticket progress.

## Completion

Read `pst pstdio-planner implementation-policy` again before handoff so changes to the settings take effect.

- When `openPr` is enabled and validation has passed, push the implementation branch and open a draft PR against `defaultTargetBranch` from the policy, or the repository's default branch when unset. A value such as `origin/main` selects `main` on `origin`. Reuse an existing PR for that branch. Follow the repository's PR title rules. Like a ticket title, the PR title names what gets better for the person, not the code change. Write the description with the sections of the repository's PR template, such as `.github/pull_request_template.md`, in the same order, and include the ticket shorthand. Without a template, include the ticket shorthand, a summary, and validation results. With GitHub CLI, use `gh pr create --draft --base <target-branch> --title <title> --body-file <path>`. The body file replaces the template, so copy its headings into the file.
  - Inspect the diff against that target. A stacked branch can include prerequisite changes that have not reached the target yet. Name those dependencies and their PRs in the description. Do not claim they are merged or change a configured PR target to hide them.
- Read the ticket's `reviewLinks` with `pst tickets panel --id <shorthand>`. If the PR URL is not already linked, run `pst tickets link-review --id <shorthand> --url <pr-url>`. Include the PR URL in the handoff. If pushing, creating, or linking the PR fails, report the blocker without claiming that step succeeded.
- When `openPr` is disabled, skip PR creation and linking unless the user requested them.

## Change request report

The report must explain the change and include outputs that a reviewer can inspect. See [Write a report](https://prompt.studio/docs/extensions/reports/#write-a-report).

1. Run `pst reports write --kind change_request --name change_request --template change-request` and keep the returned `name`, `path`, and `filesPath`. The paths are absolute locations in the default project folder on the host, not the active worktree or remote environment.
2. Explain why the change is needed and why you chose the implementation.
3. Link the ticket, relevant code, documentation, ADRs, designs, and other useful resources.
4. Always state anything left undone, any shortcuts taken, and any blockers encountered. Write `None` when a section has nothing to report.
5. Explain how to validate the change. Add command outputs, screenshots, logs, or traces under the returned `filesPath`.
6. Complete the report at the returned `path`.
7. Run `pst reports save --name <returned-name>` and keep its `reportId` for revision submission.

Report creation never overwrites an existing report. When the base file exists, the command returns a numbered report such as `change_request_01` at `.pstdio/extension-storage/pstdio-reports/reports/change_request/report_01.md`.

Only an independent reviewer creates a review report. The implementation agent uses a change request report.

Report evidence includes:

- Test, build, and run outputs
- Walkthroughs of the change
- Design documents or architecture diagrams
- Screenshots or screen recordings (UI / E2E)
- `curl` responses
- Any file needed to prove the ticket is implemented correctly

Use concrete artifacts that another person or agent can inspect and reproduce.


### Repair a changed dependency base

For a `tickets next` action of `update-stack`, reuse the listed workspace and its implementation session. See [Updating a dependency stack](https://prompt.studio/docs/extensions/planner/attempts/#updating-a-dependency-stack). Read the ticket and existing review findings. Run `pst pstdio-planner update-stack` with the exact workspace HEAD and owner session; resolve any merge conflicts, commit, and retry. Preserve the ticket's branch and PR target rules. Validate the result, run the configured adversarial review, save a fresh report, and submit the exact HEAD with `--expected-revision`. A passed review stays on its old revision; do not fabricate a rejection or reopen it to permit a correction. Complete required CI on the latest pushed PR commit.

### Recover a missing workspace

A `recover-workspace` action is runnable work. Dispatch it through Auto Build. Planner creates a managed continuation from available Git code and passes the old attempt, session, revision, report and PR references. Missing workspace availability alone does not require a human decision or a blocked ticket.

In the continuation, read those references and restore previous code from surviving branches, commits or PRs. Fetch the PR branch when needed. If no previous code can be found, restart from the ticket requirements. Record what was recovered and what had to be redone. Keep the new assigned workspace and branch, integrate required dependencies with update-stack, validate, and submit a fresh revision. Old attempts and approvals remain historical evidence; they do not approve the recovered revision. Real dependency, access, assignment and human-input rules still apply. Never replace an intact workspace or a running owner merely to repair a stack.
