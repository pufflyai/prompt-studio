---
"pstdio": patch
---

Fix npm entrypoint failing under Node.js due to require() in ESM scope by renaming bin/pstdio.js to bin/pstdio.cjs
