---
"pstdio": patch
---

Extensions running with `pstdio.backendRuntime: "process"` can pass callbacks to host APIs and use returned handles and streams, including `storage.migrate`, `storage.observe`, `storage.log`, session streams and connection streams.
