---
"@pstdio/sdk": minor
"pstdio": minor
"pstdio-core-workspace": minor
---

Introduce `pstdio-core-workspace` extension owning the `set-attempt-status` command, and add `ctx.workspaces.setAttemptStatus(...)` + `workspaceCommands.setAttemptStatus` ref to the SDK. The workspace attempt-status REST endpoint now dispatches through `runner.execute` so extensions can attach middleware to gate the transition. Auto-installs as a default extension.
