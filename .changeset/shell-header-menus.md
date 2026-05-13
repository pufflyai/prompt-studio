---
"pstdio": minor
---

Add area-scoped menu paths (`headerLeadingMenuPath(area)`, `headerTrailingMenuPath(area)`) plus canonical `workbenchCommandPaletteMenuPath`, `workbenchTopHeaderLeadingMenuPath`, `workbenchTopHeaderTrailingMenuPath`. Workbench top header now renders a leading menu surface alongside the existing trailing one. Drop the `topActionMenuPath` and `commandPaletteMenuPath` props from `ShellWorkbench` — consumers register actions at the built-in paths.
