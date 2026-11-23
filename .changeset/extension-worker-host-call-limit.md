---
"pstdio": patch
---

A process-mode extension that floods the host with calls now gets `extension_overloaded` past 4,096 calls in flight instead of growing host memory without bound.
