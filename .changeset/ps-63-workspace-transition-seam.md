---
"pstdio": patch
---

Route all workspace and workspace_sessions sync emits through the service seam and log a `sync_emit_skipped` warn when a DB write is a no-op.
