---
"pstdio-planner": minor
---

Move a ticket into the in-progress column automatically when a session starts for its workspace (new `session.started` hook). Best-effort and idempotent — a ticket already in progress, a missing ticket, or a project without an in-progress column is left untouched.
