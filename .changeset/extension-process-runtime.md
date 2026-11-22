---
"pstdio": patch
---

Extensions can set `"pstdio": { "backendRuntime": "process" }` to run their commands, middleware and hooks in their own worker process, so a slow or CPU-heavy extension no longer freezes Prompt Studio. Harnesses and workspace types are not available in this mode yet.
