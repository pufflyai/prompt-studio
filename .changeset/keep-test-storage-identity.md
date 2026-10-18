---
"pstdio": patch
"@pstdio/sdk": patch
---

Keep the storage passed to `makeCommandContext` so tests that patch it or pass a whole storage override reach the command again.
