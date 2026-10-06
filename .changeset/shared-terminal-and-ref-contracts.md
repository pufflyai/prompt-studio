---
"@pstdio/sdk": patch
"@pstdio/ui": patch
"@pstdio/workbench": patch
"pstdio": patch
---

Share one terminal session contract and one contribution id rule: the SDK exports `contributionRefId`, `commandRefId` and the renderer terminal types, and `@pstdio/ui`, `@pstdio/workbench` and the host use them instead of copies.
