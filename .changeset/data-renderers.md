---
"pstdio": minor
---

Add `renderers.registerDataRenderer` as a third workbench renderer kind alongside widget and tree renderers. Data renderers contribute schema (tag definitions, grouping/ordering/display options, filter categories), data via `executeQuery(state)`, row-mutation callbacks, and an optional `savedViews` config — when set, the built-in `WorkbenchDataView` shows a save/save-as/rename/duplicate/delete menu wired to `workbench.savedViews`. Auto-registers a widget renderer with the same id so the workspace is placed via `layout.registerWidget`. Migrates the dashboard ticket widget to the new primitive.
