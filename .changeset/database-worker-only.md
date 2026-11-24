---
"pstdio": patch
---

Prompt Studio always runs its database in a separate thread, so long queries and bursts of writes leave requests, health checks, and cancellation responsive. This replaces the `PSTDIO_DATABASE_WORKER` setting.
