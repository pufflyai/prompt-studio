---
"pstdio": patch
---

Promote the extension webview bridge and runtime-ui helpers from the staging `__TO_MIGRATE/` folder to public locations under `pstdio-extensions`. `bridge/host`, `bridge/guest`, and `bridge/contract` are exposed via subpath exports so dashboard hosts and guest webviews can build against them; runtime-ui's `resolveMenuContributionsForSlot`, `sortDiagnostics`, and `groupDiagnosticsBySeverity` are re-exported from the package root.
