# Managed Attempts and Workspace Activity

Planner stores workflow state in one managed attempt record per workspace. Host
workspace and session records provide execution data, but they do not own review
verdicts or ticket transitions. Existing workspaces without an attempt record
remain unmanaged.

## Current Flow

1. `pstdio-planner.attempt-readiness` resolves the full dependency graph and an
   exact base commit. A safe unmerged dependency stack uses its unique containing
   workspace tip.
2. `pstdio-planner.run-attempt` acquires an atomic ticket claim, recomputes
   readiness, creates the workspace from that commit, and starts an implementation
   session with `ticket` and `planner-attempt` anchors.
3. The implementation agent saves a change request report and calls
   `pstdio-planner.submit-change-request`. Planner validates the session,
   workspace HEAD, report, and expected attempt state before appending a revision.
4. The repo-local `pstdio-planner-loops` extension starts one review for the
   oldest `review_ready` revision. The review session has `planner-review` and
   `planner-attempt` anchors.
5. The reviewer calls `pstdio-planner.submit-review` with an explicit verdict and
   structured threads. Requested changes return to the same implementation
   session. Approval creates a `Human Requested` handoff and suppresses another
   automatic review of that revision.
6. Reconciliation resumes a disconnected implementation session once. A
   disconnected review gets one linked review round. A second disconnect blocks
   only that attempt and requests human input.

`pstdio-planner.workspace-activity` returns `{ active, sessions }`. It preserves
session anchors and derives each managed phase as `implementation`, `review`, or
`other`. `queued`, `in_progress`, and `awaiting_input` are live statuses.

Ticket status is a Planner rollup. Active implementation wins, followed by
review-ready, reviewing, or approved work. A ticket becomes blocked only when all
viable managed attempts are blocked. Done remains an external merge or delivery
decision. The stable `Human Requested` flag pauses this rollup and every scheduled
loop until its matching handoff is resolved by a human or agent action.

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
