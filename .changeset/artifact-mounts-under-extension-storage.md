---
"pstdio": minor
---

Move artifact mount roots from `.pstdio/<package-name>/` to `.pstdio/extension-storage/<package-name>/` so extension package names can never collide with host-owned `.pstdio/` entries such as docs, reports, extensions, and config.json
