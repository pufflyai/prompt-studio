---
"pstdio": minor
"@pstdio/desktop": minor
---

Breaking: 0.46 starts with a new database; data from older releases is exported as JSON to `~/.pstdio/backups/pre-0.46-*` for agents to re-import, and `ctx.storage.readLegacy` now always returns undefined.
