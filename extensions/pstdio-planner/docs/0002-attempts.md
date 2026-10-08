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

## Dependencies

A ticket can depend on other tickets. Set dependencies with `--depends-on` on [`pst tickets create` and `pst tickets update`](0004-cli.md#dependencies).

Before an attempt starts, Planner checks every ticket the ticket depends on, directly or through other tickets:

- A dependency in the Done status is finished.
- When no dependencies are left, the attempt starts from the commit you chose, or from the project folder's current commit.
- An unfinished dependency needs exactly one approved attempt, or the attempt selected for that ticket. The new attempt then starts from that attempt's latest commit, so it builds on the work that is not merged yet. With several unfinished dependencies, one of their attempts must already contain the others' commits.
- If a dependency has no approved or selected attempt yet, Run attempt cannot start.

When Run attempt cannot start, its dialog and command show the blocker and the next step. A missing dependency, a dependency loop, or ambiguous attempts also ask a person to fix the ticket graph or choose an attempt. Run attempt also refuses a second start while another start for the same ticket is still running. `attempt-readiness` returns a structured `reason` for agents and the CLI.

## How Planner sets the ticket status

Planner sets the ticket status from its attempts:

1. If any attempt is being implemented or has changes requested, the ticket is In Progress.
2. Otherwise, if any attempt waits for review, is being reviewed, or is approved, the ticket is In Review.
3. Otherwise, if every attempt is blocked, the ticket is Blocked.

Planner leaves tickets in Done alone. While the Review Needed flag is set, Planner does not change the ticket status, and automation extensions are expected to skip the ticket. The flag clears when a person or an agent resolves the last open request with `resolve-human-request`. Automations cannot resolve requests.

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
| `request-human`         | Sets the Review Needed flag with a question for a person.                        |
| `resolve-human-request` | Answers that question. Only a person or an agent can do this, not an automation. |
| `workspace-activity`    | Returns a workspace's sessions and whether any of them is still running.         |

In `workspace-activity`, each session carries a phase: `implementation`, `review`, or `other`. The statuses `queued`, `in_progress`, and `awaiting_input` count as running.

Use these commands for workflow state. Workspace and session records only describe what is running. They do not store review results or ticket statuses.

## Ticket cleanup and merge settings

Archiving or deleting a ticket deletes linked workspaces once no active ticket uses them and the project setting **Delete linked workspaces** (`tickets.deleteLinkedWorkspaces`) is on. The setting is on by default. Deletion removes the worktree, its branch, and any uncommitted changes. The default project workspace and providers without deletion support stay available. Unarchiving restores the ticket, but does not restore deleted workspaces.

The project setting **Mark done on merge** (`tickets.markDoneOnMerge`) is also on by default. Local merges move linked tickets to Done. Planner checks GitHub pull request links and linked workspace branches every five minutes with up to eight parallel checks. Install and authenticate GitHub CLI (`gh`) on the host for these checks. Failed GitHub checks leave tickets unchanged and log the failure. Merges do not archive tickets or delete workspaces.
