---
"pstdio": patch
---

With `PSTDIO_DATABASE_WORKER=1`, Prompt Studio opens its database in a separate thread, so long queries and bursts of writes no longer block requests, health checks or cancellation. It is off by default while it is qualified on every platform.
