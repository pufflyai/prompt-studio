# Planner Workspace Status

Core attempt-status hooks were removed with the backend ticket tables. Workspace
review status now belongs to the `pstdio-planner` extension.

## Current Flow

Planner stores review status per ticket-linked workspace and runs the workflow
automation itself:

1. A ticket attempt starts a host workspace and implementation session.
2. Session start moves the planner ticket to `In Progress`.
3. Setting planner workspace status to `review-ready` creates a review session
   with `original_session_id`.
4. Setting planner workspace status to `changes-requested` sends the review
   results back to the original implementation session.
5. Setting every linked active workspace to `reviewed` moves the planner ticket
   to `In Review`.

## Removed Core Surface

These are no longer current APIs:

- `PATCH /v1/workspaces/:id/attempt-status`
- `pst workspaces set-status`
- `attemptStatusEvents.changed`
- `post-attempt-status-*` hooks

Use planner commands and planner-owned storage for ticket workflow automation.
