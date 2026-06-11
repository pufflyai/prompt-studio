---
"pstdio": patch
---

Dispatch agent sessions to extension-contributed harnesses: the backend resolves namespaced harness ids from installed extensions (data migration included), per-project harness availability follows extension enablement (project-create agent selection disables unselected harness extensions; /agents/* accept a project filter), and CLI agent commands resolve bare ids against /agents/info.
