---
"@pstdio/workbench": patch
"pstdio": patch
---

Keep editor focus and selection across saves: skip saves of unchanged content, defer refresh reloads while a draft or save exists, and only remount the editor when a reload returns different content.
