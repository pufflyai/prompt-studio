---
status: "superseded"
created: "2026-03-31T12:00:00Z"
---

# Superseded: Attempt Status Hooks

This proposal is no longer the current direction.

Core attempt-status hooks were removed when ticket tables moved out of the
backend. Planner ticket workflow automation now lives in the `pstdio-planner`
extension and is driven by planner workspace status commands/storage.

Current behavior:

1. Planner ticket attempts create host workspaces and sessions through planner
   commands.
2. Session start moves the planner ticket to `In Progress`.
3. Planner workspace status `review-ready` starts a review session.
4. Planner workspace status `changes-requested` follows up the original
   implementation session.
5. Planner workspace status `reviewed` contributes to the aggregate transition
   that moves the planner ticket to `In Review`.

Removed core concepts:

- `pre-attempt-status-*`
- `post-attempt-status-*`
- `attemptStatusEvents.changed`
- `PATCH /v1/workspaces/:id/attempt-status`
- core attempt-status tables
