# Extension Automation Interface

Extensions are the automation interface for lifecycle checks, follow-up work, and user-triggered workflow actions.

## Blocking Automation

Blocking checks belong in command middleware. Middleware receives the command context, can inspect command parameters and project resources, and either calls `next()` or returns a rejected command result.

## Non-Blocking Automation

Post-change behavior belongs in event handlers. Event handlers react to ticket, worktree, session, and attempt-status lifecycle events after the state change has been accepted.

## User Actions

User-triggered workflow actions should be extension commands, optionally exposed through menu contributions or the command palette.
