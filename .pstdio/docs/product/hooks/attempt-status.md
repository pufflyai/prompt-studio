# Planner Workspace Status

Core attempt-status hooks were removed with the backend ticket tables. Workspace
review status now belongs to the `pstdio-planner` extension.

## Current Flow

Planner stores review status per ticket-linked workspace and runs workflow
automation itself:

1. `pstdio-planner.create-workspace` can create a ticket-linked host workspace
   without starting a session.
2. `pstdio-planner.run-attempt` creates a ticket-linked host workspace and
   implementation session.
3. Session start moves the planner ticket to `In Progress`.
4. Setting planner workspace status to `review-ready` creates a review session
   with `original_session_id`.
5. Setting planner workspace status to `changes-requested` sends the review
   results back to the original implementation session.
6. Setting every linked active workspace to `reviewed` moves the planner ticket
   to `In Review`.

Both workspace creation commands pass the planner ticket shorthand as
`shorthand_base`. That keeps host workspace shorthands in the
`<ticket>_A<n>` format and avoids rebuilding ticket attempt naming in the
backend or dashboard.

## Removed Core Surface

These are no longer current APIs:

- `PATCH /v1/workspaces/:id/attempt-status`
- `pst workspaces set-status`
- `attemptStatusEvents.changed`
- `post-attempt-status-*` hooks

Use planner commands and planner-owned storage for ticket workflow automation.
Dashboard code should host planner workbench contributions and command
outcomes, not implement ticket workflow logic itself.
