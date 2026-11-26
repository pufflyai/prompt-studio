---
"pstdio": patch
---

Speed up legacy storage upgrades and require an upgraded project to open and save an edit within 20 seconds before release.

On an upgrade from 0.48 to 0.49, the app batch-imports settled records and transfers into a fresh database and keeps the original database beside it with the suffix `.before-0.49`. Projects with pending edits use the existing migration so those edits can still sync.

When upgrading from the old record layout, the app discards historical record-save receipts. It also discards old document-save IDs when both edit queues are empty. Document contents, saved revisions and edit history survive the upgrade. An extension retrying an old save ID may submit a new save. The upgrade keeps pending edits and the decisions they still need.
