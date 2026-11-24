---
"pstdio": patch
---

Process-mode harnesses keep their event stream and approvals after `start()` returns. A call cancelled before it reaches the worker no longer runs. A busy host no longer stops healthy extension workers. Extension bundling stops after 2 minutes instead of waiting forever on a stuck macro, and output printed by macros no longer breaks it.

Cancelled process-mode calls settle promptly and release their handles after cleanup. Harness operations keep synchronous event access, and closing a process output reader releases pending reads.
