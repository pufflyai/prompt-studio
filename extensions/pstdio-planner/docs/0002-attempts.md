# Attempts

An attempt is one try at a ticket. An agent does the work in its own Git worktree, a second agent reviews it, and you decide what to do with approved work.

## Words used on this page

A workspace is a place where work on a project happens. The project folder is one workspace. Prompt Studio can create more.

A Git worktree is a second checkout of your repository in its own folder, on its own branch. An agent can change files there without touching your project folder.

A revision is one version of the work that the implementing agent hands in. An attempt can have several revisions when a reviewer asks for changes.

## Before you start

A managed attempt needs:

- A project opened from a local folder that is a Git repository with at least one commit.
- An agent, such as [Claude Code](../../harness-claude-code/README.md), [Codex](../../harness-codex/README.md), or [OpenCode](../../harness-open-code/README.md).
- The [Reports](../../pstdio-reports/README.md) extension. Agents hand in their work and their reviews as reports.

Planner refuses to start an attempt in a folder that is not a Git repository. You can still use tickets, tools, and ordinary agent sessions there.

## Workspaces on a ticket

The **Workspaces** section of a ticket lists the project folder, shown as **Project workspace**, and every workspace linked to the ticket. Open the project workspace to work directly in the project's files. Archiving a ticket never archives the project workspace.

When the project can create workspaces, the section shows **Create workspace**. It opens a form where you choose a workspace type, called a provider, and fill in its options. The new workspace is linked to the ticket, even while a remote environment is still starting. Creating a workspace does not start an agent. A plain folder or a remote project with no provider shows no create action.

To link an existing workspace or session to a ticket, use [`pst tickets link`](0004-cli.md#link-workspaces-and-sessions).

## Run an attempt

Open a ticket and choose **Run attempt** from its actions menu. Pick the agent and the branch to start from. From a terminal, run:

```sh
pst pstdio-planner run-attempt --ticket PS-12
```

Planner then does the following:

1. It checks that the ticket can start. See [Dependencies](#dependencies).
2. It creates a Git worktree from the chosen commit, links it to the ticket, and starts an implementation session there. The ticket moves to In Progress.
3. When the agent finishes, it saves a change request report and submits it. Planner checks that the report and the latest commit belong to this workspace, then records a new revision.
4. A review starts when someone chooses **Run review** from the workspace's actions menu, or runs `pst pstdio-planner run-review --workspace-id <workspace>`. An agent or an automation can run the same command. Each revision gets at most one review.
5. The reviewing agent saves a review report and submits a verdict: passed, or changes requested.
6. If the reviewer requests changes, Planner sends the findings back to the same implementation session, and the cycle repeats from step 3.
7. If the review passes, Planner sets the ticket's Review Needed flag and asks a person to choose, merge, or otherwise handle the approved work.

Planner does not merge work. Merging, delivering, and moving the ticket to Done are your decisions.

If two implementation sessions are already running in the project, Run attempt does not start another one. To change the limit, open **Settings → Project → Extensions**, select **Prompt Studio Planner**, and set **Maximum in-progress tickets** on its **Settings** tab.

`pst tickets implement` is a lighter option. It moves the ticket to In Progress and starts one agent session with the implement-ticket prompt. It does not create a worktree, a managed attempt, or a review.

## Auto Build

Auto Build uses a supervisor to query work with `pst tickets next` and dispatch matching tickets through the same readiness checks as manual implementation. It reuses stopped implementation owners when they can continue and assigns changed-stack repair in their existing workspaces. It does not approve or merge PRs.

With **Block on review** off, submitted revisions can provide dependency bases before review finishes. Missing, ambiguous, actively replaced, and human-blocked dependencies still wait. Independent dependency branches can be combined when their changes merge cleanly. Independent tickets can run together up to the implementation session limit. Stop prevents future prompts and dispatches while running work continues.

See [Auto Build](0007-auto-build.md) for scope filters, recovery, CLI commands, and settings.

## Dependencies

A ticket can depend on other tickets. Set dependencies with `--depends-on` on [`pst tickets create` and `pst tickets update`](0004-cli.md#dependencies).

Before an attempt starts, Planner checks every ticket the ticket depends on, directly or through other tickets:

- Done describes ticket completion. It does not prove that a managed dependency's code reached the chosen base. Planner checks whether that base contains the submitted commit or its recorded merge commit. A completed human task with no managed attempt needs no Git integration.
- When all dependency code is integrated, the attempt starts from the commit you chose, or from the project folder's current commit.
- An unfinished dependency needs exactly one approved attempt, or the attempt selected for that ticket. A Done managed dependency can use its submitted revision. The new attempt starts from a dependency tip that contains all required code and the chosen base. Otherwise, Planner combines the submitted branches into an attempt base without changing the target branch. If those branches conflict, the implementation owner starts from a clean base and reconciles them in its assigned workspace.
- If a dependency has no approved or selected attempt yet, Run attempt cannot start.

When Run attempt cannot start, its dialog and command show the blocker and the next step. A missing dependency, a dependency loop, or ambiguous attempts also ask a person to fix the ticket graph or choose an attempt. Run attempt also refuses a second start while another start for the same ticket is still running. `attempt-readiness` returns a structured `reason` for agents and the CLI.

## Updating a dependency stack

An upstream revision can change after a child starts. The child must contain the current selected dependency commits before submitting another revision. Planner checks actual Git ancestry at submission and again before recording it. A changed HEAD, changed dependency base, detached implementation session, or concurrent revision write causes submission to fail with a retry instruction.

Use the same implementation owner and workspace:

```sh
pst pstdio-planner update-stack --workspace-id <workspace> --implementation-session-id <owner> --expected-head-sha <head>
```

The command requires committed changes and no other live workspace session. It integrates the current dependency base with a Git merge so existing published history remains intact. If the merge conflicts, resolve and commit it, then retry. Run the affected checks, save a fresh change request report, and submit the exact resulting HEAD with `--expected-revision <last-revision-number>`. Updating the base does not submit or validate a revision by itself.

Git conflicts are the implementation owner's work. It must preserve the required behavior from both sides, reconcile the files, commit the resolution, and validate. Planner does not create a human request for conflicting code. Ask for human input only when features, concepts, requirements, plans, or architecture conflict and the existing instructions cannot decide the intended behavior. When dependency branches need reconciliation, the recorded base stays on the original clean commit and the submitted revision includes the dependency integration and resolution. Submission checks that its HEAD contains every required dependency commit. Describe those prerequisite changes in the change request report.

An attempt with no submitted revision can also need this repair. Keep its existing workspace and implementation owner, commit any work in progress, and run `update-stack`. This is authorized dependency integration; it does not approve work, merge into the delivery target, or mark prerequisites Done. The assigned branch is where the agent edits. The dependency base supplies prerequisite code. The delivery target is the branch where reviewed work will eventually be merged.

Answering a human request does not change Git. After an answer, the owner must check the actual files and dependency commits. If the same missing-code blocker remains, repair the stack before resuming implementation rather than repeating the request.

For a root ticket deliberately moved to another target branch, pass `--base <target-branch>` to align its recorded base. Dependencies whose code is absent still determine a dependent ticket's base; this option cannot bypass them.

A revision identifies both its base and HEAD. Correcting a recorded base can create a fresh revision with the same HEAD and a fresh report; prior review evidence remains on the original base/HEAD pair. Even retrying an existing submission rechecks current dependency ancestry.

An owner can submit a later correction after a passed review. Earlier review evidence stays attached to its original commit. The optional `--expected-attempt-state` parameter is deprecated in 0.44 and removed in 0.45; ownership, exact HEAD, and `--expected-revision` protect submission. Human review requests retain the old state guard through 0.44; use the workspace owner and `--revision` guard instead. No extra mandatory managed review is introduced by stack repair. A live implementation owner cannot supply a dependency revision while replacing that work.

## How Planner sets the ticket status

Planner sets managed ticket status from its attempts, sessions, and human requests:

1. An open or unreadable human request makes the ticket Blocked.
2. An implementation or changes-requested attempt is In Progress while its session is queued or running. It is Blocked while its session awaits input, and Todo after its session stops so unfinished work can resume in the same attempt.
3. Otherwise, if any attempt waits for review, is being reviewed, or is approved, the ticket is In Review.
4. Otherwise, if every attempt is blocked, the ticket is Blocked.

Planner leaves tickets in Done alone. Session lifecycle events and request changes refresh managed ticket status. Background checks also repair stale status, including when Auto Build is off. Attempt readiness waits for open or unreadable requests on the target and all its prerequisites, including completed ones. Automation extensions, including Auto build, must use `attempt-readiness` before `run-attempt`. A manual or stale tag alone does not block launch. The flag clears when a person or an agent answers or cancels the last open request. Automations cannot answer or cancel requests. See [Review requests](0006-review-requests.md).

## When a session disconnects

If an implementation session disconnects, Planner resumes it once. If a review session disconnects, Planner starts one new review. If a session disconnects a second time, Planner blocks only that attempt and asks a person for input.

Planner checks for disconnects when someone runs `pst pstdio-planner reconcile-attempt --workspace-id <workspace>`.

## Use attempts from another extension

Extensions and agents drive attempts through Planner's commands. Each ID below is short for `pstdio.pstdio-planner.command.<id>`. All of them except `workspace-activity` also run from the CLI. Run `pst pstdio-planner <id> --help` to see their parameters.

| Command                 | What it does                                                                     |
| ----------------------- | -------------------------------------------------------------------------------- |
| `attempt-readiness`     | Checks whether a ticket can start and which commit it would start from.          |
| `run-attempt`           | Creates the worktree and starts the implementation session.                      |
| `submit-change-request` | Hands in a revision with its change request report.                              |
| `run-review`            | Starts a review of the latest revision.                                          |
| `submit-review`         | Records the reviewer's verdict and review threads.                               |
| `list-attempts`         | Lists the project's attempts.                                                    |
| `reconcile-attempt`     | Recovers an attempt whose session disconnected.                                  |
| `select-attempt`        | Chooses which attempt of a ticket later tickets build on. Not for automations.   |
| `request-human`         | Asks a person for a task confirmation or a decision and sets Review Needed.      |
| `review`                | Answers a review request. Only a person or an agent can do this.                 |
| `workspace-activity`    | Returns a workspace's sessions and whether any of them is still running.         |

In `workspace-activity`, each session carries a phase: `implementation`, `review`, or `other`. The statuses `queued`, `in_progress`, and `awaiting_input` count as running.

Use these commands for workflow state. Workspace and session records only describe what is running. They do not store review results or ticket statuses.

## Ticket cleanup and merge settings

Archiving or deleting a ticket deletes linked workspaces once no active ticket uses them and the project setting **Delete linked workspaces** (`tickets.deleteLinkedWorkspaces`) is on. The setting is on by default. Deletion removes the worktree, its branch, and any uncommitted changes. The default project workspace and providers without deletion support stay available. Unarchiving restores the ticket, but does not restore deleted workspaces.

The project setting **Mark done on merge** (`tickets.markDoneOnMerge`) is also on by default. Local merges move linked tickets to Done. Planner checks GitHub pull request links and linked workspace branches every five minutes with up to eight parallel checks. Install and authenticate GitHub CLI (`gh`) on the host for these checks. Failed GitHub checks leave tickets unchanged and log the failure. Merges do not archive tickets or delete workspaces.
