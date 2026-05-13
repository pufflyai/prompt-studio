---
"pstdio": minor
---

Add `shell.breadcrumbs` controller (single trail at a time). `setItems(items)` returns a Disposable that clears its own items on dispose. Workbench reads from the controller and falls back to an active-widget breadcrumb when nothing is set. Drop the `breadcrumbItems` prop from `ShellWorkbench`. The hardcoded `resource.kind === "project"` parent-finding in the workbench breadcrumb builder is gone — consumers are responsible for their own trail.
