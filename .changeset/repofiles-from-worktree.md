---
"pstdio": patch
---

Resolve repoFiles for extension commands run from inside a worktree-backed workspace: a worktree now maps to its owning registered repo and mounts its own working tree, so `pst tickets save`/`pull` work from a workspace instead of failing with "This command must be run inside a project repository."
