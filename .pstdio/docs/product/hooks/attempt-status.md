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

`session_id` is only needed to point back to the agent session that performed the status change, so deferred `post-attempt-status-*` delivery is attached to the right session.

If a user runs `pstdio workspaces set-status` manually, `--session-id` can be omitted. The status update still applies to the workspace.

When calling `pstdio workspaces set-status` from agent automation, pass `--session-id` whenever the session id is available. If the flag is omitted, the CLI falls back to `PSTDIO_SESSION_ID` when present.

Why this matters:

1. Multiple sessions can run concurrently in a single workspace.
2. Workspace-only context is ambiguous for session-bound post-hook delivery.
3. Queue behavior is intentionally "last status wins" per session, so the correct session key is required.

Provider note:

- Claude Code flows can read `PSTDIO_SESSION_ID` from env, and `pstdio workspaces set-status` can fall back to it.
- OpenCode flows should use a `shell.env` bridge that maps OpenCode `sessionID` to the pstdio session id and exports `PSTDIO_SESSION_ID` into shell execution.

If the OpenCode bridge cannot resolve a pstdio session id, the status update can still succeed, but deferred `post-attempt-status-*` delivery remains sessionless and is not queued.

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
