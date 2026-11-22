---
"pstdio": patch
"@pstdio/sdk": patch
---

Extensions can list host environment variable names in `pstdio.processEnvironment` and pass a granted value to one child with `envFromHost` on `ctx.process.run`, `runOrThrow` and `spawnDetached`. You allow names per project and extension source in the extension's details or with `pst extensions permissions`; changed source needs a new grant, and revoking stops the children that received the value. The host no longer reads `PSTDIO_EXTENSION_PROCESS_ENV`.
