---
"pstdio": patch
---

A process-mode extension gets `extension_overloaded` past 4,096 regular host calls in flight. A bounded reserve lets cleanup calls release work at the limit.
