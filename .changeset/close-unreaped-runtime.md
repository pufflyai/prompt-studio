---
"pstdio": patch
---

`pst close` now returns once the runtime stops, even in a container whose init process never reaps it.
