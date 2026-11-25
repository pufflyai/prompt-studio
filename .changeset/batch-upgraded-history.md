---
"pstdio": patch
---

Speed up legacy storage upgrades and require an upgraded project to open and save an edit within 20 seconds before release.

When upgrading from the old record layout, the app discards historical record-save receipts. An extension retrying an old save ID may submit a new save. The upgrade keeps pending edits and the decisions they still need.
