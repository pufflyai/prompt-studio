// Terminal session contracts shared between the host PTY supervisor (pstdio-api),
// the extension SDK surface (ctx.terminal), and the renderer-side terminal package.
//
// Shell resolution (documented here as the source of truth for the host supervisor):
//   POSIX:   $SHELL, then /bin/zsh -> /bin/bash -> /bin/sh
//   Windows: %ComSpec%, then powershell.exe
// The first entry that exists on disk wins; if none resolve the host throws
// `TerminalShellNotFound`.

export interface TerminalSessionRequest {
  /** Command + args to run; defaults to the user's login shell when omitted. */
  command?: string[];
  /** Working directory; falls back to the extension's workspace root. */
  cwd?: string;
  /** Extra env vars merged over the inherited environment. */
  env?: Record<string, string>;
  /** Initial column count; the renderer can resize later. */
  cols: number;
  /** Initial row count; the renderer can resize later. */
  rows: number;
}

export type TerminalEvent =
  | { kind: "data"; chunk: Uint8Array }
  // Name of the PTY's foreground process (VSCode-style tab titles); re-emitted whenever it changes.
  | { kind: "title"; title: string }
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null }
  | { kind: "error"; message: string };

export interface TerminalSessionHandle {
  /** Stable session id. */
  readonly id: string;
  /** Send stdin to the PTY. */
  write(data: string | Uint8Array): void;
  /** Adjust the PTY geometry. */
  resize(cols: number, rows: number): void;
  /** Terminate the child and clean up host resources. */
  kill(signal?: NodeJS.Signals): Promise<void>;
  /**
   * Async iterable of output / exit / error events. A single iterator is
   * supported per session — calling this twice throws. `exit` is always the
   * last event delivered for a session.
   */
  events(): AsyncIterable<TerminalEvent>;
}

// Browser <-> API messages for the bidirectional terminal WebSocket. Binary
// PTY chunks are base64 encoded so the protocol remains JSON serializable.
export type TerminalWebSocketClientMessage =
  | { type: "open"; request: TerminalSessionRequest }
  | { type: "write"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "kill"; signal?: string };

export type TerminalWebSocketServerMessage =
  | { type: "open"; sessionId: string }
  | { type: "data"; chunk: string }
  | { type: "title"; title: string }
  | { type: "exit"; code: number | null; signal: string | null }
  | { type: "error"; message: string };

// Serializable operations a webview sends over the `terminal.session` capability.
// Raw `TerminalSessionHandle` objects never cross the webview boundary — `open`
// returns only a session id and every follow-up operation addresses that id.
export type TerminalSessionOperation =
  | { operation: "open"; request: TerminalSessionRequest }
  | { operation: "write"; sessionId: string; data: string | Uint8Array }
  | { operation: "resize"; sessionId: string; cols: number; rows: number }
  | { operation: "kill"; sessionId: string; signal?: string }
  | { operation: "subscribe"; sessionId: string };

export type TerminalSessionResult =
  | { operation: "open"; sessionId: string }
  | { operation: "write" | "resize" | "kill" | "subscribe"; accepted: true };

// Host -> renderer bridge events. Output is chunked by the host (never one event
// per byte) to keep the bridge responsive under noisy shells.
export type TerminalHostEvent =
  | { sessionId: string; kind: "data"; chunk: Uint8Array }
  | { sessionId: string; kind: "exit"; code: number | null; signal: string | null };

// Renderer -> host bridge events.
export type TerminalRendererEvent =
  | { sessionId: string; kind: "write"; data: Uint8Array }
  | { sessionId: string; kind: "resize"; cols: number; rows: number }
  | { sessionId: string; kind: "kill"; signal?: string };
