---
"pstdio": minor
---

Tabs now live in header areas. Each `*-header` area auto-renders tabs derived from the corresponding content area's widget placements: `left-header` ↔ `left`, `main-header` ↔ `main`, `main-left-header` ↔ `main-left`, `main-right-header` ↔ `main-right`. Adding multiple widgets to a content area automatically surfaces tabs in its header. `ShellArea`'s own tab strip is removed (it was dormant). `main-bottom` keeps `ShellBottomPanel`'s tab UI for now — diagnostics/activity will move to widget contributions in a follow-up.
