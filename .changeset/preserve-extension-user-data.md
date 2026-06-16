---
"pstdio": patch
"@pstdio/ui": patch
---

Preserve extension user data: a missing source no longer prunes a data-bearing install, the instance foreign keys now restrict instead of cascade, and uninstall keeps data by default with an explicit opt-in to delete it.
