---
"pstdio": patch
---

Coalesce Cloud status notifications and reuse unchanged owner observations so status reporting does not repeatedly compete with reconnect catch-up. Storage commits and transport progress immediately invalidate the affected owner.
