---
"pstdio": minor
---

Add four workbench primitives that unblock dashboard migration: keep-alive widget host (subtrees survive area/mode changes), widened navigation dispatcher (`openTarget` / `navigate` accept resource, view, command, and compound targets), in-memory editor history (`goBack` / `goForward` / `goPrevious` / `recentlyClosed` / `reopenLastClosed`), and scoped layout persistence (`setPersistenceScope` keys layout state per project/workspace).
