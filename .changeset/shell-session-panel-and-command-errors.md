---
"pstdio": minor
---

Add `shell.sessionPanel` controller (`getMode`, `setMode`, `onDidChange`) and `shell.commands.onDidExecuteError` event. `createShellCore` accepts `initialSessionPanelMode` in its input. The final two `ShellWorkbench` props (`initialSessionPanelMode`, `onCommandError`) are dropped, along with the `ShellSessionPanelProvider` + `useShellSessionPanelStore` Zustand wrapper. `ShellWorkbench` now takes only `{ shell }`. Consumers who want to handle command execution failures subscribe via `shell.commands.onDidExecuteError(...)`.
