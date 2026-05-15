---
"pstdio": patch
---

Add unified `createDashboardShell` factory and `TanStackShellAdapter` in `pstdio-dashboard`. Mounted once at the dashboard root; the seven existing per-route shell factories continue to own UI. Foundation for the PS-281 dashboard shell consolidation.
