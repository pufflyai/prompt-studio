---
"pstdio": patch
"@pstdio/workbench": patch
---

Keep the workbench fast while extension webviews stay open. Messages to a webview no longer leave a listener behind on the host window.
