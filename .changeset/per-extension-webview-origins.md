---
"pstdio": minor
"@pstdio/desktop": minor
"@pstdio/workbench": minor
---

Serve each extension's webviews from its own origin, so webviews get real browser storage, can embed third-party web apps, and run in their own process. Workbench webview metadata now requires `originLabel`, and hosts give webviews `allow-same-origin` only when the runtime loads from a different origin than the host page.
