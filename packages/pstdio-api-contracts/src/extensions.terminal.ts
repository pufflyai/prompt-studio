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
