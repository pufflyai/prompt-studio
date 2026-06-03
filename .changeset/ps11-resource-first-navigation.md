---
"pstdio": patch
---

Make workbench navigation resource-first: add a shared navigation contract suite and route helpers (registerResourceRoute, registerExtensionResourceView); convert the sessions, workspaces, extension board, and ticket-view routes onto them; derive extension view metadata at render time instead of storing it as history identity; replay mode-layout extension views on Back/Forward; and clear project-scoped history when the project is deselected.
