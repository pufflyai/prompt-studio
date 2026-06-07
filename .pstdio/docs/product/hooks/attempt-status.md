# Attempt Status

An attempt is a unit of work on a ticket, typically an agent session running in a worktree.

Each attempt has a status that tracks lifecycle progress.

## How It Works

1. Users define allowed attempt statuses in project config.
2. Agents update attempt status during a session (for example via `mark-attempt-status`).
3. Later session/workspace hook payloads include `attempt_status`, and hooks automate follow-up behavior from that value.

This keeps agents focused on signaling intent, while hooks own workflow automation.

## Session Correlation

Attempt status is workspace-scoped.

`session_id` is used to point back to the agent session that performed the status change when post-hook delivery must be deferred until that session ends.

If a user runs `pst workspaces set-status` manually, `--session-id` can be omitted. The status update still applies to the workspace.

When calling `pst workspaces set-status` from agent automation, pass `--session-id` whenever the session id is available. If the flag is omitted, the CLI falls back to `PSTDIO_SESSION_ID` when present.

Delivery behavior:

1. If `session_id` is present, `post-attempt-status-*` is queued and delivered when that session reaches a terminal state.
2. If `session_id` is absent, `post-attempt-status-*` runs immediately after the status commit.

Why this matters:

1. Multiple sessions can run concurrently in a single workspace.
2. Workspace-only context is ambiguous for session-bound post-hook delivery.
3. Queue behavior is intentionally "last status wins" per session, so the correct session key is required.

Provider note:

- Claude Code flows can read `PSTDIO_SESSION_ID` from env, and `pst workspaces set-status` can fall back to it.
- OpenCode flows should use a `shell.env` bridge that maps OpenCode `sessionID` to the Prompt Studio session id and exports `PSTDIO_SESSION_ID` into shell execution.

If the OpenCode bridge cannot resolve a Prompt Studio session id, the status update still succeeds and `post-attempt-status-*` falls back to immediate delivery (non-deferred).

## Configuration

Default attempt statuses:

```json
{
  "attemptStatuses": [
    "wip",
    "blocked",
    "review-ready",
    "reviewed",
    "changes-requested"
  ]
}
```

Statuses are freeform strings constrained only by the configured set.
