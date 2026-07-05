import type { TerminalHostEvent, TerminalSessionOperation, TerminalSessionRequest } from "../api/terminal";
import type { GuestHost } from "./define-extension-view";

const TERMINAL_SESSION_CAPABILITY = "terminal.session";

export interface TerminalSessionExit {
  code: number | null;
  signal: string | null;
}

/**
 * Renderer-side session over the `terminal.session` capability. Structurally
 * compatible with the `TerminalSessionAdapter` contract of `@pstdio/ui/terminal`,
 * so it plugs straight into the `Terminal` component's `bridge` prop.
 */
export interface TerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void>;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  onExit(handler: (exit: TerminalSessionExit) => void): () => void;
  onError(handler: (error: { message: string }) => void): () => void;
}

export interface TerminalSessionBridge {
  openSession(request: TerminalSessionRequest): Promise<TerminalSessionAdapter>;
}

/**
 * Builds a terminal bridge for an extension webview from its `GuestHost`.
 * Operations go through `host.call("terminal.session", ...)`; output and exit
 * events arrive through the host event channel. The webview must declare the
 * `terminal.session` capability or every call is rejected by the host gate.
 */
export const createTerminalSessionBridge = (host: GuestHost): TerminalSessionBridge => ({
  async openSession(request) {
    const call = (operation: TerminalSessionOperation) => host.call(TERMINAL_SESSION_CAPABILITY, operation);
    const opened = (await call({ operation: "open", request })) as { sessionId: string };
    const sessionId = opened.sessionId;

    const dataHandlers = new Set<(chunk: Uint8Array) => void>();
    const exitHandlers = new Set<(exit: TerminalSessionExit) => void>();
    const errorHandlers = new Set<(error: { message: string }) => void>();

    // Fire-and-forget operations can be rejected by the host during the window
    // between session death and UI teardown — surface that through onError
    // instead of leaking an unhandled rejection.
    const callDetached = (operation: TerminalSessionOperation) => {
      call(operation).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        for (const handler of errorHandlers) handler({ message });
      });
    };
    // The host streams as soon as `subscribe` lands, which can be before the
    // terminal component binds its handlers — buffer until the first one attaches.
    const pendingData: Uint8Array[] = [];
    let pendingExit: TerminalSessionExit | null = null;

    const unsubscribeHostEvents = host.onEvent(TERMINAL_SESSION_CAPABILITY, (payload) => {
      const event = payload as TerminalHostEvent;
      if (event.sessionId !== sessionId) return;
      if (event.kind === "data") {
        if (dataHandlers.size === 0) {
          pendingData.push(event.chunk);
          return;
        }
        for (const handler of dataHandlers) handler(event.chunk);
        return;
      }
      const exit = { code: event.code, signal: event.signal };
      if (exitHandlers.size === 0) pendingExit = exit;
      for (const handler of exitHandlers) handler(exit);
      unsubscribeHostEvents();
    });

    await call({ operation: "subscribe", sessionId });

    return {
      id: sessionId,
      write(data) {
        callDetached({ operation: "write", sessionId, data });
      },
      resize(cols, rows) {
        callDetached({ operation: "resize", sessionId, cols, rows });
      },
      async kill(signal) {
        await call({ operation: "kill", sessionId, signal });
      },
      onData(handler) {
        dataHandlers.add(handler);
        while (pendingData.length > 0) handler(pendingData.shift() as Uint8Array);
        return () => dataHandlers.delete(handler);
      },
      onExit(handler) {
        exitHandlers.add(handler);
        if (pendingExit) {
          handler(pendingExit);
          pendingExit = null;
        }
        return () => exitHandlers.delete(handler);
      },
      onError(handler) {
        errorHandlers.add(handler);
        return () => errorHandlers.delete(handler);
      },
    };
  },
});
