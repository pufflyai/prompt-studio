---
"pstdio": patch
"@pstdio/sdk": patch
---

Pass the session's approval channel to harnesses on a session's first turn, not only when it resumes. `HarnessStartInput.approvals` is now part of the start input; older hosts pass it only on resume, so treat it as optional.
