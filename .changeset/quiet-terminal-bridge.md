---
"@pstdio/sdk": patch
"pstdio": patch
---

Add the `terminal.session` webview bridge contract (open/write/resize/kill/next-event) and forward an optional `terminal` API onto `ctx.terminal` for extension command/event/setup contexts. The production runtime is wired to the existing Bun PTY supervisor (owned by the app lifecycle), the workbench host gates `terminal.session` calls behind the declared capability, and the extension testbench ships a deterministic scripted terminal host for previews and tests.
