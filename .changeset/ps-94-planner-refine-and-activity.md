---
"pstdio-planner": minor
"pstdio": minor
---

Split planner data from loops: add the `Refine` status, `human_requested` tag, `workspace-activity` command, and `runReview` command; remove the workspace-status surface (collections, settings panel, commands) and migrate existing projects; new `pstdio-loops` extension owns the session-start hook and the configurable refinement/implementation/review/stuck-sweep loops behind `automations.enabled`
