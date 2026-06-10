---
"pstdio": patch
---

Fix the dashboard crashing on a dropped sync stream: the connection-lost screen renders above the workbench's Chakra provider, so it now brings its own and shows the reconnect page instead of a blank crash.
