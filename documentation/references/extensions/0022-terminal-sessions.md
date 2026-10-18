# Terminal sessions

Use host terminal surfaces for interactive shells and command-scoped terminal handles for extension execution.

Supported Bash and Zsh shells report foreground activity, including builtins such as `read`.
Waiting or editing at the prompt is idle. Background and stopped jobs do not count.
Direct programs stay active until exit. Unknown process state counts as activity.

The host terminal panel runs shells in a PTY (pseudo-terminal).

Commands and hooks get `ctx.terminal` (an `ExtensionTerminalApi`) when the host provides a PTY supervisor. `ctx.terminal.openSession(request)` returns a host-side `TerminalSessionHandle` with `write`, `resize`, `kill`, and an `events()` iterable that one consumer can read. The handle never reaches renderer code.

`terminal.session` and `createTerminalSessionBridge` are deprecated in 0.44. Use the host
terminal surface for new views. Existing webviews can still declare the `terminal.session` capability. It is the only public webview terminal capability in this version. Its calls are serializable operations: `open`, `write`, `resize`, `kill`, and `subscribe`. `open` returns only a `sessionId`, and the bridge pushes output and exit events to the webview. Use `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` to get a bridge for the `Terminal` component from `@pstdio/ui/terminal`. The capability gate rejects webviews that did not declare the capability.

Closing a terminal panel kills its session. A session opened through `ctx.terminal` belongs to the invocation that opened it and is killed when that invocation ends. When the app exits, the PTY supervisor kills any session that is still running.

`kill()` signals the session's process group, so the shell and everything it started stop together. The default signal is `SIGHUP`, which shells honor even when they ignore `SIGTERM`. The host then sends `SIGKILL` to the group, because a shell that exits may leave children running. The call always settles. A job that moves to its own process group and ignores the hangup keeps running, as `nohup` jobs do in any terminal.

In the dashboard, a WebSocket at `/v1/terminal` opens a PTY in the runtime and carries output, exit, input, resize, and kill messages. Webviews that declare `terminal.session` use this same transport.

Logs record only lifecycle data: session ID, process ID, exit code, and signal. Terminal content is never logged.

