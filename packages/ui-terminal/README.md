# @pstdio/ui-terminal

Renderer-side terminal UI for Prompt Studio extensions. Wraps
[xterm.js](https://xtermjs.org/) and the fit addon in a React component and
binds it to a `terminal.session` bridge adapter exposed by the host runtime.

The package is intentionally narrow: it owns rendering and bridge wiring only.
The actual PTY supervisor lives in `pstdio-api`, and the bridge transport that
exposes it to webviews lives in `pstdio-extensions`. Extensions never reach
into either; they receive a `TerminalBridge` adapter (or instantiate the
exported scripted stub) and pass it to `<Terminal />`.

## Installation

```sh
bun add @pstdio/ui-terminal
```

`react` and `react-dom` are peer dependencies.

Import the package stylesheet once in your webview entrypoint:

```ts
import "@pstdio/ui-terminal/style.css";
```

## Usage

```tsx
import "@pstdio/ui-terminal/style.css";
import { Terminal, type TerminalBridge } from "@pstdio/ui-terminal";

function ExtensionTerminalView({ bridge }: { bridge: TerminalBridge }) {
  return (
    <div style={{ height: "100%" }}>
      <Terminal bridge={bridge} theme="dark" />
    </div>
  );
}
```

The component:

- opens a session through `bridge.openSession({ cols, rows, ... })` on mount,
- forwards xterm input to `session.write(...)`,
- forwards session output to `xterm.write(...)`,
- resizes the host PTY whenever the container changes size,
- kills the session on unmount (opt out with `killOnUnmount={false}`).

### Low-level hook

For advanced webviews that need direct access to the session (custom shells,
multiple panes, screen recorders, etc.), use `useTerminalSession`:

```tsx
import { useTerminalSession } from "@pstdio/ui-terminal";

const request = { cols: 80, rows: 24 };

const { session, status } = useTerminalSession({
  bridge,
  request,
});

// session.onData / session.write / session.resize ...
```

### Bridge adapter contract

A `TerminalBridge` is a thin renderer-side projection over the
`terminal.session` webview capability:

```ts
interface TerminalBridge {
  openSession(request: TerminalSessionRequest): Promise<TerminalSessionAdapter>;
}

interface TerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void> | void;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  onExit(handler: (exit: { code: number | null; signal: string | null }) => void): () => void;
  onError(handler: (error: { message: string }) => void): () => void;
}
```

The host-side `TerminalSessionHandle` uses a single-consumer async iterable;
the renderer side instead uses observable subscriptions because that pattern
maps cleanly to React effects. Bridge implementations are responsible for
translating their own transport into the callbacks above.

### Declaring the bridge in your extension

Webview extensions must declare the capability before the host will route any
terminal traffic:

```ts
export default {
  views: {
    terminal: {
      title: "Terminal",
      webview: {
        entry: "./src/terminal-view.tsx",
        capabilities: ["terminal.session"],
      },
    },
  },
};
```

(The capability declaration lives in `pstdio-api-contracts` and is wired up by
the host as part of the terminal panel work — see `PS-32`.)

### Testing and stories

`createScriptedTerminalBridge` returns a deterministic in-memory bridge that
replays a script of output steps and responds to user input. It powers the
Storybook stories in this package and is the recommended fixture for tests
that exercise terminal UI without spawning a real shell.

## Scripts

- `bun run --cwd packages/ui-terminal build` — Vite library build (ESM + d.ts)
- `bun run --cwd packages/ui-terminal test` — `bun test`
- `bun run --cwd packages/ui-terminal storybook` — Storybook dev server (port 6066)
