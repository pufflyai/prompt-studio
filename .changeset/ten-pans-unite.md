---
"pstdio": patch
"planner": patch
---

Start loading an extension panel’s JavaScript while its webview connects.

Serve published panel assets while dependency fingerprinting and replacement builds run in the background.

Use Bun’s resolved browser inputs to reduce first-time preparation for source-backed panels.

Reduce repeated relationship checks and metadata reads when a bundled Planner panel opens.

Load Planner request and Auto Build dialogs on interaction, and avoid rereading saved-view schemas for ticket windows.

Reuse declared webview entries across a panel’s chunks while retaining source admission and per-request publication checks.
