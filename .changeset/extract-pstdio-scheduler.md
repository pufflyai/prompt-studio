---
"pstdio": patch
---

Extract a new private `pstdio-scheduler` package built on `Bun.cron` and replace the in-process polling scheduler in `pstdio-api` with a thin adapter.
