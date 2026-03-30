# Attempt Status

An attempt is a unit of work on a ticket, typically an agent session running in a worktree.

Each attempt has a status that tracks lifecycle progress.

## How It Works

1. Users define allowed attempt statuses in project config.
2. Agents update attempt status during a session (for example via `mark-attempt-status`).
3. Later session/workspace hook payloads include `attempt_status`, and hooks automate follow-up behavior from that value.

This keeps agents focused on signaling intent, while hooks own workflow automation.

## Configuration

```json
{
  "attemptStatuses": [
    "running",
    "blocked",
    "review-ready",
    "reviewed",
    "changes-requested"
  ]
}
```

Statuses are freeform strings constrained only by the configured set.
