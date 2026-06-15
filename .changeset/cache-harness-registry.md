---
"pstdio": patch
---

Cache the harness registry per scope and memoize harness availability detection so session and agent endpoints stop rebuilding the registry and re-spawning `<cli> --version` on every request.
