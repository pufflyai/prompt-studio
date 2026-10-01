---
"@pstdio/sdk": patch
"pstdio": patch
---

Add scoped harness worker cleanup on extension reload, disablement, and host shutdown, through the new optional `HarnessProvider.dispose` callback in extension API 0.1.1.
