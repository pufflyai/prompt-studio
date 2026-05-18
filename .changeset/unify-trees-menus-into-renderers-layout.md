---
"pstdio": minor
---

Unify workbench contributions around two primitives. Trees are now renderers placed by widgets: `trees.registerTreeView` becomes `renderers.registerTreeRenderer` (drops `area`/`role`/`areaSize`/`getRoots`; renames `getSections` to `getBody`; adds optional `getFooter` returning `TreeNode[]`). Menu items move out of `menus`: `menus.registerMenuAction` / `MenuAction` / `RegisteredMenuAction` become `layout.registerMenuItem` / `MenuItem` / `RegisteredMenuItem`, and `workbench.menus.listMenuActions` becomes `workbench.layout.listMenuItems`. The shell no longer resolves trees by `(area, role)` — each tree auto-registers a widget renderer with the same id and is placed via `layout.registerWidget({ rendererId })` + `layout.openWidget`.
