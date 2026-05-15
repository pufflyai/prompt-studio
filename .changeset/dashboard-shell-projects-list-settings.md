---
"pstdio": patch
---

Migrate the `/projects` and `/settings` dashboard routes to the unified shell's `dashboard.projects-list` and `dashboard.settings` modes. Deletes the per-route `dashboard-settings-shell` factory. The unified shell now activates its initial mode synchronously at construction so the first commit shows the active widget. Foundation continues for PS-281.
