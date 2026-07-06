import type { TerminalHostEvent, TerminalSessionOperation, TerminalSessionResult } from "@pstdio/sdk/api";
import type { HostCapability } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchTerminalController } from "../../core";

export const TERMINAL_SESSION_EVENT_SCOPE = "terminal.session";

interface CreateTerminalSessionCapabilityInput {
  terminal: WorkbenchTerminalController;
  hostEvents: HostEventPublisher;
}

/**
 * Host side of the `terminal.session` webview capability. Sessions live in the
 * workbench terminal controller; only serializable operation payloads and session
 * ids cross the webview boundary. Output/exit events flow through the host event
 * publisher under the `terminal.session` scope.
 */
export const createTerminalSessionCapability = (input: CreateTerminalSessionCapabilityInput): HostCapability => {
  const { terminal, hostEvents } = input;

  const emit = (payload: TerminalHostEvent) => {
    hostEvents.emit({ scope: TERMINAL_SESSION_EVENT_SCOPE, payload });
  };

  return async (params) => {
    const operation = params as TerminalSessionOperation;

    switch (operation.operation) {
      case "open": {
        const { sessionId } = await terminal.open({ request: operation.request });
        return { operation: "open", sessionId } satisfies TerminalSessionResult;
      }
      case "write":
        terminal.write({ sessionId: operation.sessionId, data: operation.data });
        return { operation: "write", accepted: true } satisfies TerminalSessionResult;
      case "resize":
        terminal.resize({ sessionId: operation.sessionId, cols: operation.cols, rows: operation.rows });
        return { operation: "resize", accepted: true } satisfies TerminalSessionResult;
      case "kill":
        await terminal.kill({ sessionId: operation.sessionId, signal: operation.signal });
        return { operation: "kill", accepted: true } satisfies TerminalSessionResult;
      case "subscribe": {
        const { sessionId } = operation;
        let unsubscribeTerminal = () => {};
        let unsubscribeDisconnect = () => {};
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          unsubscribeTerminal();
          unsubscribeDisconnect();
        };

        unsubscribeTerminal = terminal.subscribe(sessionId, {
          onData: (chunk) => emit({ sessionId, kind: "data", chunk }),
          onExit: (exit) => {
            emit({ sessionId, kind: "exit", code: exit.code, signal: exit.signal });
            close();
          },
        });
        unsubscribeDisconnect = hostEvents.onDisconnect(close);
        return { operation: "subscribe", accepted: true } satisfies TerminalSessionResult;
      }
    }
  };
};
