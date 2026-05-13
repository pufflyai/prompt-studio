---
"pstdio": minor
---

Add per-area header slots to the shell layout (`left-header`, `main-left-header`, `main-right-header`, `main-bottom-header`) alongside the existing `main-header`. Drop the `leftHeader` ReactNode prop from `ShellWorkbench` — chrome above each panel is now a widget contribution like everything else. Persistence loaders backfill missing areas so older saved layouts keep working.
