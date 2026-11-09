---
"pstdio": patch
---

Cloud sync waits through a brief 502, 503 or 504 from the hosted service instead of restarting the download, so large projects finish their first download.
