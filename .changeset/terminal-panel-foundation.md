---
"pstdio": minor
"@pstdio/sdk": minor
---

Add the workspace terminal foundation: host-owned workbench terminal surface backed by the Bun PTY supervisor, `terminal.session` webview capability with host→guest event delivery, `ctx.terminal` runtime wiring, and `createTerminalSessionBridge` in the SDK. The workspace-mode example replaces its static terminal mock with the real surface, and dashboard extension contributions now stay live during same-project metadata refreshes.
