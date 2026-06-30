---
"pstdio": patch
---

Fix a skill showing "Out of date" in the dashboard when its installed version already matches the catalog — the badge now compares versions instead of file content, so cosmetic drift no longer flags an update. Also drop the redundant "Skill updated" toast and refresh the skill viewer after an update so it no longer shows the stale version.
