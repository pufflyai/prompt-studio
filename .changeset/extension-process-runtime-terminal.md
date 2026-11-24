---
"pstdio": patch
---

Extensions running with `pstdio.backendRuntime: "process"` can open terminal sessions with `ctx.terminal.openSession`. A host call that is still running when its handler returns now delivers its result instead of failing.
