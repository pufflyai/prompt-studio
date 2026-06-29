---
"pstdio": patch
"@pstdio/sdk": patch
"pstdio-worktree-setup": patch
---

Write the host workspace id into `.pstdio/config.json` when bootstrapping a workspace worktree so commands run from inside the worktree can resolve the current workspace without a flag, and expose it on extension command context as `ctx.workspaceId`.
