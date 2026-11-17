---
"pstdio": patch
---

Release the idle overflow extension preparation worker while preserving stateful watches and restarting parallel preparation when needed. Check Windows process liveness through its native process handle instead of undefined active-process exit-time output.
