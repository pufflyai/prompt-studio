---
"@pstdio/workbench": patch
"@pstdio/ui": patch
"pstdio": patch
---

Keep editor focus and selection across saves: the markdown editor no longer reports the initial content import as an edit, saves of unchanged content are skipped, refresh events during a save are treated as self-invalidation, and a reload only remounts the editor when the content actually changed.
