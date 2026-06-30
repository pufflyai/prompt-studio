---
"@pstdio/sdk": minor
"pstdio": patch
---

Provision agent skills through an awaited workspace lifecycle so a session never starts before its skill files exist — fixing the intermittent "Unknown skill" in worktree-backed sessions. Workspace creation now emits an awaited `workspace.provision` event (harness extensions sync their own skill directory) before the workspace is marked ready, session launch waits for readiness, and background setup runs on a non-blocking `workspace.ready`. Harness extensions own their file contributions via the new `ctx.skills` and `ctx.workspaceFiles.syncDir` SDK surfaces, so the host no longer hardcodes `.claude`/`.opencode`/`.agents`.
