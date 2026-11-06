---
"pstdio": patch
"@pstdio/workbench": patch
---

Reuse page ordering during navigation while preserving independent page lists and registration updates.

Avoid recursively serializing unrelated shortcut arguments while resolving direct command hints.

Update shortcut hint components only when the displayed hint changes, while observing current command availability and shortcut preferences.

Skip numbered tab geometry and geometry-driven hint updates while shortcut mode and preview are hidden.
