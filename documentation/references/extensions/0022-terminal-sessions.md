# Terminal sessions

Use host terminal surfaces for interactive shells and command-scoped terminal handles for extension execution.

Supported Bash and Zsh shells report foreground activity, including builtins such as `read`.
Waiting or editing at the prompt is idle. Background and stopped jobs do not count.
Direct programs stay active until exit. Unknown process state counts as activity.

The host terminal panel runs shells in a PTY (pseudo-terminal).

## Native terminal views

On `main`, after 0.46.0, declare a terminal with `defineView` from
`@pstdio/sdk/extensions`. This additive surface shares the planned API 0.4.0
release. Use a published SDK exporting `TerminalViewBody`, manifest engine
`^0.4.0`, and a host advertising `view.terminal.v1`. Hosts missing this capability
report the ordinary `extension_host_capability_missing` diagnostic. Hosts without
a PTY supervisor reject opening the session. The SDK and compatible host must
be released before a production extension adopts this declaration.

```ts
const shell = defineView({
  id: "shell",
  title: "Shell",
  body: {
    kind: "terminal",
    session: (_ctx, { renderer }) => ({
      workspaceId: renderer.resource?.type === "workspace"
        ? renderer.resource.id
        : undefined,
      env: { TOOL_NAME: "my-console" },
    }),
  },
});
```

Place this view in an ordinary page slot or placement and open it through public
page/panel navigation. No extension React entry, UI bundle, webview, or terminal
bridge is required. Input, output, resize, foreground titles, and exit use the
existing native renderer and PTY supervisor.

The `session` callback returns `TerminalViewSession`: optional `workspaceId`,
`command` (executable and arguments), and extra `env`. Without a command the host
opens its shell. Without a workspace ID the host uses the project's default
workspace. The host resolves the working directory from the current ready local
workspace, enforcing project ownership, readiness, and deletion checks. A
renderer cannot supply a different command or working directory. Remote
workspaces are unsupported by this native PTY surface. Resource context must
belong to the same project as the view.

The callback runs with ordinary invocation-scoped services. It returns launch
settings, never a process handle. After it returns, the interactive PTY belongs
to the presentation and its installed owner. Returning from the command that
opened the panel does not end the PTY. Movement, hiding, mode changes, and
unchanged contribution refreshes preserve its binding. Different projects or
owners never share a session even when their placement IDs match. Explicit tab
closure, removal/replacement of the installed owner, disconnecting its terminal
transport, and host shutdown stop its PTY. Closing or disposing an owner while
admission is pending also releases any late session.

The authenticated `/v1/terminal` transport accepts `openView` with only the
project/view binding, resource context, and dimensions. The host invokes the
enabled view's callback and keeps the live handle. Each socket controls only its
own session. The deprecated webview bridge can address only sessions it opened;
knowing another presentation's session ID grants no access.

## Invocation-scoped handles

Commands and hooks get `ctx.terminal` (an `ExtensionTerminalApi`) when the host provides a PTY supervisor. `ctx.terminal.openSession(request)` returns a host-side `TerminalSessionHandle` with `write`, `resize`, `kill`, and an `events()` iterable that one consumer can read. The handle never reaches renderer code.

`terminal.session` and `createTerminalSessionBridge` are deprecated in 0.44. Use the host
terminal surface for new views. Existing webviews can still declare the `terminal.session` capability. It is the only public webview terminal capability in this version. Its calls are serializable operations: `open`, `write`, `resize`, `kill`, and `subscribe`. `open` returns only a `sessionId`, and the bridge pushes output and exit events to the webview. Use `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` to get a bridge for the `Terminal` component from `@pstdio/ui/terminal`. The capability gate rejects webviews that did not declare the capability.

Closing a terminal panel kills its session; closing the workbench that shows it does not. A session opened through `ctx.terminal` belongs to the invocation that opened it and is killed when that invocation ends. When the app exits, the PTY supervisor kills any session that is still running.

`kill()` signals the session's process group, so the shell and everything it started stop together. The default signal is `SIGHUP`, which shells honor even when they ignore `SIGTERM`. The host then sends `SIGKILL` to the group, because a shell that exits may leave children running. The call always settles. A job that moves to its own process group and ignores the hangup keeps running, as `nohup` jobs do in any terminal.

In the dashboard, a WebSocket at `/v1/terminal` opens a PTY in the runtime and carries output, exit, input, resize, and kill messages. Webviews that declare `terminal.session` use this same transport.

A terminal panel opens its PTY with an attach key made of its project and panel placement. Such a PTY outlives its socket: closing the workbench that shows it, such as closing a desktop project tab or reloading the page, only detaches it. Reopening the panel resumes the same shell and replays up to 256 KiB of its recent output. Only closing the panel, the process exiting, or the app exiting ends it. A second window that opens the same panel while the PTY is attached elsewhere gets its own shell. A PTY opened without an attach key still ends with its socket.

Logs record only lifecycle data: session ID, process ID, exit code, and signal. Terminal content is never logged.

*Updated at: 2026-11-11*
