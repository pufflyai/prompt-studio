---
"pstdio": patch
---

Serve the dashboard correctly from a source checkout on Windows. Filesystem
asset keys were `\`-separated while requests look them up with `/`, so every
nested asset fell through to `index.html` and `pst serve` rendered a blank
page.
