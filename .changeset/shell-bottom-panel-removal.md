---
"pstdio": minor
---

`main-bottom` is now a regular area with the same tabs-in-header treatment as the other panels. `ShellBottomPanel`, `ShellDiagnosticsPanel`, and `ShellActivityFeed` are removed — the workbench no longer auto-surfaces diagnostics/activity as tabs. Consumers who want diagnostics or activity visible can register their own widgets that read from `shell.diagnostics` / `shell.activity`.
