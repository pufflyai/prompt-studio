---
status: "superseded"
created: "2026-03-31T12:00:00Z"
---

# Superseded: Attempt Status Hooks

This proposal is no longer the current direction.

Core attempt-status hooks were removed when ticket tables moved out of the
backend. Planner ticket workflow automation now lives in the `pstdio-planner`
extension. Planner stores one managed attempt record per workspace and drives
the workflow through its attempt commands. See [Attempts](../0002-attempts.md)
for the current flow.

These are not current APIs:

- `pre-attempt-status-*` and `post-attempt-status-*` hooks
- `attemptStatusEvents.changed`
- `PATCH /v1/workspaces/:id/attempt-status`
- Core attempt-status tables
- Core workspace status mutation and the old planner workspace-status command family
- The old command that inferred ticket status from workspace state
- Workspace-status settings and their legacy storage collections
- Ticket-status inference from generic session start or completion hooks
