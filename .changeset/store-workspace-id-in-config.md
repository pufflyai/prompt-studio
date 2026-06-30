---
"@pstdio/sdk": minor
"pstdio": patch
---

Stamp the host workspace id into a worktree's `.pstdio/config.json` on creation so CLI and extension commands run from inside the worktree resolve their current workspace without a flag. The execute endpoint resolves the worktree path from the workspace id and threads both into the command environment, surfacing `ctx.workspaceId` to commands.
