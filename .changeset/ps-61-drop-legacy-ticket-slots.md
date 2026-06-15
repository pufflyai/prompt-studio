---
"pstdio": patch
"@pstdio/sdk": patch
---

Drop the framework's hardcoded `ticket` slot inference and open `templateTypeSchema` to a string so extensions own their own template types and slot ids.
