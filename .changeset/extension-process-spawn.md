---
"pstdio": patch
"@pstdio/sdk": patch
---

Extensions can start a host-owned child with `ctx.process.spawn` and talk to it while it runs: write its stdin, stream its stdout and stderr, and kill it. The child belongs to the call or to the enabled extension, runs on the selected workspace, and goes through a remote workspace provider's new `spawn` method when the workspace is remote. Harnesses can read files on a session's workspace with `ctx.targetFiles.readText`. Both work in the process runtime.
