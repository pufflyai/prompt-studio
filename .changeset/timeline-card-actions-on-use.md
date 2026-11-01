---
"pstdio-planner": patch
---

Keep the project timeline from pinning the CPU: each ticket card loads its context-menu actions once and reloads them only when you use the card after a change, instead of every card reloading them after every workbench change.
