---
"pstdio": patch
---

Restore the `GET /v1/projects/:id/extensions/ui` endpoint so the dashboard's contribution hosts (sidebar nav, header buttons, header overflow, route shell, settings panels, command palette grouping) receive the full `DashboardExtensionMetadata` shape (`extensions`, `commands`, `menuContributions`, `views`, `routes`, `navigation`, `settingsPanels`, `diagnostics`). The endpoint was deleted during the merge with the new extension command runtime; without it every contribution surface stayed empty.
