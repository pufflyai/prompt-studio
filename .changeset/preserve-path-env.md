---
"@pstdio/sdk": patch
"pstdio": patch
---

Fix runCommand to inherit runtime process.env updates when no env option is passed, so plugins picking up PATH mutations see them.
