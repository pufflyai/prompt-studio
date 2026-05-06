---
"@pstdio/ui": patch
"pstdio": patch
---

Fix markdown editor escaping underscores in bare URLs every save/reload, which broke links over multiple round-trips.
