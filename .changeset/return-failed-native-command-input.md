---
"pstdio": patch
"@pstdio/sdk": patch
"@pstdio/workbench": patch
---

A native command that fails after it started puts its text and files back in the composer again, ahead of anything typed since. The `recoverDraft` chat stream event stays and now only returns that input; there is no restore prompt.
