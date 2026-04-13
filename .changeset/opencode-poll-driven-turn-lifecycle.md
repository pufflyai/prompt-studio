---
"pstdio": patch
---

Source OpenCode turn liveness from server polling instead of the POST /message HTTP lifetime, so long-running turns no longer get marked disconnected when the POST request times out.
