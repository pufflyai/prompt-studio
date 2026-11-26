---
"pstdio": patch
---

Speed up legacy storage upgrades and require an upgraded project to open and save an edit within 20 seconds before release.

Fresh installations use one generated 0.49 database migration. Upgrading an existing 0.48 installation automatically updates incompatible first-party tools from their recorded official sources.

The 0.48 → 0.49 upgrade treats every project as local. It keeps current records, local edits, documents, attachments, saved recovery points, and unfinished uploads with bytes on disk. It discards deleted record rows, prior save IDs, sync markers, and completed transfer entries. A retry using a 0.48 save ID is a new request. The batch importer leaves a recovery copy of the previous database beside the active database with the suffix `.before-0.49`.
