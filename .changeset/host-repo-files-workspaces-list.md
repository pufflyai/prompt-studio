---
"pstdio": minor
"@pstdio/sdk": minor
---

Add generic host primitives `ctx.repoFiles` (the invocation repo's working tree, scoped to its root) and `ctx.workspaces.list()` so extension commands can read/write project files and enumerate workspaces without domain-specific core code.
