---
"pstdio": patch
---

Fix dashboard sidebar showing every session after switching between workspaces: refresh the sidebar when the primary resource changes so the session list rescopes to the newly opened workspace, and show a "No sessions yet" placeholder when the scoped workspace has no sessions
