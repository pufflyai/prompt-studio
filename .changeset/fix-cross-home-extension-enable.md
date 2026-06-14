---
"pstdio": patch
---

Enabling an installed extension now resolves the source from the host's own PSTDIO_HOME (and rejects sources managed by a different home), so a pst client running against another home can no longer register foreign extension paths that produce duplicate extension ids.
