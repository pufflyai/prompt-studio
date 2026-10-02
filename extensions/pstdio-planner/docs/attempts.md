# Managed Attempts and Workspace Activity

Planner stores workflow state in one managed attempt record per workspace. Host
workspace and session records provide execution data, but they do not own review
verdicts or ticket transitions. Existing workspaces without an attempt record
remain unmanaged.

Tickets can also use the shared project workspace. The ticket sidebar lists
**Project workspace**, and sessions keep their own ticket links. In a plain-folder
or remote project without an available creation provider, the Workspaces section
has no create action. Open the existing project workspace to work directly in its files.
Archiving a ticket does not archive the shared workspace.

When providers are available, **Create workspace** opens the host's provider form.
Choose a provider and supply its parameters. The new workspace keeps the ticket
link, including while a remote environment is still provisioning. The API command
accepts an explicit `provider_id` and `params` object.

The Git provider creates an isolated worktree. Managed implementation and review attempts always require Git and a
usable base commit. Workspace setup failures are reported before an attempt
session starts.

## When a Ticket Can Start

Only blockers decide whether a ticket can start. A ticket can start when all of these are true:

- Every ticket in `depends_on` is Done, or has exactly one attempt to build on: an
  approved attempt, or the attempt selected for that ticket. Their attempts must
  build on each other.
- Fewer attempts are being implemented than **Maximum in-progress tickets**
  (`automation.maxInProgress`, default 2) allows.
- No other Run attempt for the same ticket is still starting.

Tickets without blockers run side by side up to that limit. When a ticket cannot
start, `run-attempt` fails with a message that names the blocker and the next step,
and the Run attempt dialog shows it. A missing dependency, a dependency loop, or
dependency attempts that are ambiguous or don't build on each other also ask a
person to fix the ticket graph. `attempt-readiness` still returns the structured
`reason` for agents and the CLI.

## Current Flow

1. `pstdio.pstdio-planner.command.attempt-readiness` resolves the full dependency graph and an
   exact base commit. A safe unmerged dependency stack uses its unique containing
   workspace tip.
2. `pstdio.pstdio-planner.command.run-attempt` acquires an atomic ticket claim, recomputes
   readiness, creates the workspace from that commit, and starts an implementation
   session with `ticket` and `planner-attempt` anchors. It fails with the reason
   when the ticket cannot start.
3. The implementation agent saves a change request report and calls
   `pstdio.pstdio-planner.command.submit-change-request`. Planner validates the session,
   workspace HEAD, report, and expected attempt state before appending a revision.
4. `pstdio.pstdio-planner.command.run-review` starts one review for the oldest
   `review_ready` revision. The review session has `planner-review` and
   `planner-attempt` anchors.
5. The reviewer calls `pstdio.pstdio-planner.command.submit-review` with an explicit verdict and
   structured threads. Requested changes return to the same implementation
   session. Approval creates a `Review Needed` handoff and suppresses another
   automatic review of that revision.
6. Reconciliation resumes a disconnected implementation session once. A
   disconnected review gets one linked review round. A second disconnect blocks
   only that attempt and requests human input.

`pstdio.pstdio-planner.command.workspace-activity` returns `{ active, sessions }`. It preserves
session anchors and derives each managed phase as `implementation`, `review`, or
`other`. `queued`, `in_progress`, and `awaiting_input` are live statuses.

Ticket status is a Planner rollup. Active implementation wins, followed by
review-ready, reviewing, or approved work. A ticket becomes blocked only when all
viable managed attempts are blocked. Done remains an external merge or delivery
decision. The stable `Review Needed` flag pauses this rollup and every scheduled
loop until its matching handoff is resolved by a human or agent action.

The default flag uses a gray bell. Existing `Human Requested` flags receive this
label and appearance while keeping their IDs and ticket assignments. Custom flag
names remain unchanged.

## Removed Surface

These are not current APIs:

- `PATCH /v1/workspaces/:id/attempt-status`
- Core workspace status mutation and the old planner workspace-status command family
- The old command that inferred ticket status from workspace state
- Workspace-status settings and their legacy storage collections
- `attemptStatusEvents.changed` and `post-attempt-status-*` hooks
- Ticket-status inference from generic session start or completion hooks

Use Planner attempt commands for workflow state and workspace activity only for
live execution state.
