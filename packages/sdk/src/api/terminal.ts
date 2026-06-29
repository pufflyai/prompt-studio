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

export type TerminalHostEvent =
  | { sessionId: string; kind: "data"; chunk: Uint8Array }
  | { sessionId: string; kind: "exit"; code: number | null; signal: string | null };
