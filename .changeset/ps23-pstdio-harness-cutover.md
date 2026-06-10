---
"pstdio": patch
---

Dispatch agent sessions to extension-contributed harnesses: the backend resolves namespaced harness ids from installed extensions (data migration included), agents endpoints read availability/models from harness providers, and CLI agent commands resolve bare ids against /agents/info.
