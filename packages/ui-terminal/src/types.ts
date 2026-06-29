import type { TerminalHostEvent, TerminalSessionRequest } from "@pstdio/sdk/api";

export type { TerminalSessionRequest } from "@pstdio/sdk/api";

/**
 * Renderer-side projection of a single terminal session over the
 * `terminal.session` bridge.
 *
 * The host-side `TerminalSessionHandle` exposes a single-consumer async
 * iterable; that contract is impractical inside React, so the renderer side
 * uses observable subscriptions instead. Implementations (real bridge,
 * scripted stub, etc.) are responsible for translating their own transport
 * into these callbacks.
 */
export interface TerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void> | void;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  onExit(handler: (exit: TerminalSessionExit) => void): () => void;
  onError(handler: (error: TerminalSessionError) => void): () => void;
}

export type TerminalSessionExit = Omit<Extract<TerminalHostEvent, { kind: "exit" }>, "kind" | "sessionId">;

export interface TerminalSessionError {
  message: string;
}

/**
 * Renderer-side projection of the `terminal.session` capability. A bridge
 * adapter typically wraps the webview transport, but stubs that drive
 * scripted output (storybook, tests) implement the same shape.
 */
export interface TerminalBridge {
  openSession(request: TerminalSessionRequest): Promise<TerminalSessionAdapter>;
}
