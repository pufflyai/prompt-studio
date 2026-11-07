---
"pstdio": patch
"@pstdio/sdk": patch
"@pstdio/ui": patch
"@pstdio/workbench": patch
---

Preserve native chat queue settings, session forks, optional working folders, remote device controls, authentication channels, workspace links and durable legacy draft transfer for independently installed Sessions views. Keep dependent command pickers open, focused and keyboard-accessible while their options refresh, and apply command destination-page hints only to their captured Main viewer. Preserve live, virtualized resource-argument search with accessible status and captured command context. Send large native chat events as bounded stream frames and publish them atomically without interrupting visible history or newer local work. Recover unacknowledged native drafts after immediate reload and preserve newer work across owner replacement.

Expose the existing pure session message patch reducer through the SDK so backend native-chat providers can omit UI runtime dependencies, preserving the UI export and prompt animation identity.
