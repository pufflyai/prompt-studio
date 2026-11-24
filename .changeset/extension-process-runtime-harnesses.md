---
"pstdio": patch
---

Harnesses can run with `pstdio.backendRuntime: "process"`. Session handles, promises and handler results now cross the boundary and stay valid while the host holds them.
