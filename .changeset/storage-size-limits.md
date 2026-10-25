---
"pstdio": minor
"@pstdio/sdk": minor
---

Refuse extension storage records over 256 KiB and commits over 4 MiB, and export `storageLimits` and `isStorageLimitError`; this moves the extension API to 0.3.0, so store large content as files.
