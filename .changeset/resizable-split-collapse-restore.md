---
"@pstdio/ui": patch
---

`ResizableSplitLayout` resizable panel now sizes its cross-axis via `alignSelf="stretch"` instead of `h="full"` (a percentage height). Chrome fails to re-resolve `height: 100%` on a flex item after a `display: none → flex` toggle, which caused the file tree (and other content inside the resizable panel) to collapse to its content height when the panel was closed and reopened.
