# Workspace Activity

Stored workspace statuses were removed with PS-94. Workspace state is now derived
live from the sessions linked to a workspace, and automation policy lives in the
repo-local `.pstdio/extensions/pstdio-planner-loops` extension.

## Current Flow

1. `pstdio-planner.create-workspace` can create a ticket-linked host workspace
   without starting a session.
2. `pstdio-planner.run-attempt` creates a ticket-linked host workspace and
   implementation session.
3. The `pstdio-planner-loops` `sessionStarted` hook moves the planner ticket to
   `In Progress` when a session starts for a ticket-linked workspace.
4. `pstdio-planner.workspace-activity` returns `{ active, sessions }` for a
   workspace: `queued`, `in_progress`, and `awaiting_input` sessions keep it
   active; `completed`, `failed`, `cancelled`, and `disconnected` do not.
5. The `pstdio-planner-loops` extension's scheduled commands (refinement,
   implementation, stuck-work sweep, review) drive ticket transitions from that
   live state. Despite its historical package name, it is ordinary extension
   automation built from commands, schedules, hooks, settings, and storage.

Both workspace creation commands pass the planner ticket shorthand as
`shorthand_base`. That keeps host workspace shorthands in the
`<ticket>_A<n>` format and avoids rebuilding ticket attempt naming in the
backend or dashboard.

## Removed Surface

These are no longer current APIs:

- `PATCH /v1/workspaces/:id/attempt-status`
- `pst workspaces set-status` and the `pstdio-planner.workspaceStatus.*` commands
- `pst tickets update-when-attempt-status`
- The planner workspace-status settings panel and its
  `workspace-status-definitions` / `workspace-status-values` collections
- `attemptStatusEvents.changed` and `post-attempt-status-*` hooks

Use `pstdio-planner.workspace-activity` for live state and the repo-local
`pstdio-planner-loops` extension for ticket workflow automation.
