---
"pstdio": patch
---

The runtime closes its database before a fatal exit, and extension watcher or session start cleanup errors no longer stop it.
