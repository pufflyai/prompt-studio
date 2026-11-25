---
"pstdio": patch
---

Extensions running with `pstdio.backendRuntime: "process"` can use `storage.positions`, `storage.assets`, `urlFor` and `records.id` inside `storage.scope(...)`. A process-mode extension's worker stops after 10 minutes without calls.
