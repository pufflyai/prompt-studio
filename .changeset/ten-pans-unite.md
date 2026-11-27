---
"pstdio": patch
"@pstdio/sdk": patch
"planner": patch
---

Start loading an extension panel’s JavaScript while its webview connects.

Serve published panel assets while dependency fingerprinting and replacement builds run in the background.

Use Bun’s resolved browser inputs to reduce first-time preparation for source-backed panels.

Reduce repeated relationship checks and metadata reads when a bundled Planner panel opens.

Reconcile a panel’s first invalidated data read promptly while keeping repeated background reads bounded.
