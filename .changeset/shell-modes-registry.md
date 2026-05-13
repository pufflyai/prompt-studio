---
"pstdio": minor
---

Add `shell.modes` registry for switchable workbench presets. Add `role: "primary" | "footer"` on `TreeViewContribution` and drop `leftTreeViewId`/`leftFooterTreeViewId` props from `ShellWorkbench` — the workbench now auto-resolves tree views by area+role.
