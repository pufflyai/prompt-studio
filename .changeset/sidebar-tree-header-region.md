---
"pstdio": patch
---

Sidebar tree renderer gains a header region that mirrors its footer (compact rows, no padding); the dashboard's search / new-session rows move out of the left-header into it. Right-clicking the tree now hides/shows header rows, footer rows, body categories, and top-level nav entries (Tickets, Sessions, Workspaces, extension boards/links) via explicit canHide; individual leaf items stay non-hideable. Modals also get a 1px border.
