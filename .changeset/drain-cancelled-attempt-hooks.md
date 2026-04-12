---
"pstdio": patch
---

Deprecate the post-hook queue: `postAttemptStatusChange` now fires immediately on transition instead of being deferred until the session reaches a terminal state.
