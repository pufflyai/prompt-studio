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

// Serializable operations a webview sends over the `terminal.session` capability.
// `open` returns only a session id; every follow-up operation addresses that id.
export type TerminalSessionOperation =
  | { operation: "open"; request: TerminalSessionRequest }
  | { operation: "write"; sessionId: string; data: string | Uint8Array }
  | { operation: "resize"; sessionId: string; cols: number; rows: number }
  | { operation: "kill"; sessionId: string; signal?: string }
  | { operation: "subscribe"; sessionId: string };

export type TerminalSessionResult =
  | { operation: "open"; sessionId: string }
  | { operation: "write" | "resize" | "kill" | "subscribe"; accepted: true };

export type TerminalHostEvent =
  | { sessionId: string; kind: "data"; chunk: Uint8Array }
  | { sessionId: string; kind: "exit"; code: number | null; signal: string | null };
