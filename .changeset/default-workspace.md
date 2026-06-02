---
"pstdio": minor
"@pstdio/sdk": patch
---

Add a default workspace per project that targets the root repo on its current branch. It is created automatically when a repo is registered, appears first in the session workspace selector (showing the repo name and branch), and cannot be deleted. Workspaces now expose an `is_default` flag.
