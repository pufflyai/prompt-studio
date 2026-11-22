---
"pstdio": patch
---

Processes that a process-mode extension starts itself now stop with its worker, also when the worker crashes or is stopped for hanging. Each worker's exit code and peak memory are recorded in the runtime diagnostics.
