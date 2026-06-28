---
"pstdio-planner": patch
---

Drop the `default-` prefix from seeded ticket status ids (`backlog`, `ready`, `in-progress`, `blocked`, `in-review`, `done`) so the raw status id reads cleanly for API and LLM consumers
