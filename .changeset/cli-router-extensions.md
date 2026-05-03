---
"pstdio": minor
---

Build kernel CLI router that consumes normalized v2 extension command records. Generates namespace and command-level help with provider metadata, refuses static/extension and extension/extension CLI path collisions, prints recovery messaging when familiar first-party paths are missing (planner tickets, harness claude-code), and dispatches executable extension commands through the API command endpoint.
