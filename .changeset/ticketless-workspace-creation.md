---
"pstdio": minor
"@pstdio/sdk": minor
"@pstdio/ui": minor
---

Create worktree-backed workspaces without a ticket. `POST /v1/workspaces` and `pstdio workspace create` now provision a real git worktree from just a project (optional base ref), and the dashboard gains a working "New workspace" action plus a per-row "Delete workspace" context menu. The data renderer now supports per-row context-menu actions.
