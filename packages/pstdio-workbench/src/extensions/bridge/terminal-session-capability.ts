import type { TerminalHostEvent, TerminalSessionOperation, TerminalSessionResult } from "@pstdio/sdk/api";
import type { HostCapability } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchTerminalController } from "../../core";
import { captureTerminalBindingStop } from "../../core/controllers/terminal/terminal-binding-stops";

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
export const createTerminalSessionCapability = (input: CreateTerminalSessionCapabilityInput) => {
  const { terminal, hostEvents } = input;
  const ownedSessions = new Set<string>();
  const bindings = new Set<string>();
  const ownerId = crypto.randomUUID();
  const subscriptions = new Set<() => void>();
  let disposed = false;
  let closing = false;
  let captured: ReturnType<typeof captureTerminalBindingStop>;

  const emit = (payload: TerminalHostEvent) => {
    hostEvents.emit({ scope: TERMINAL_SESSION_EVENT_SCOPE, payload });
  };

  const open = async (request: Extract<TerminalSessionOperation, { operation: "open" }>["request"]) => {
    if (closing) throw new Error("Terminal owner is closing");
    const bindingId = crypto.randomUUID();
    bindings.add(bindingId);
    try {
      const { sessionId } = await terminal.open({ ownerId, bindingId, request });
      if (disposed) throw new Error("Terminal owner is disposed");
      ownedSessions.add(sessionId);
      return { operation: "open", sessionId } satisfies TerminalSessionResult;
    } finally {
      if (!captureTerminalBindingStop(terminal, bindingId, ownerId)) bindings.delete(bindingId);
    }
  };
  const capability: HostCapability = async (params) => {
    if (disposed) throw new Error("Terminal owner is disposed");
    const operation = params as TerminalSessionOperation;
    if (operation.operation !== "open" && !ownedSessions.has(operation.sessionId))
      throw new Error("Unknown terminal session for this owner");

    switch (operation.operation) {
      case "open":
        return open(operation.request);
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
          subscriptions.delete(close);
          unsubscribeTerminal();
          unsubscribeDisconnect();
        };

        subscriptions.add(close);
        unsubscribeTerminal = terminal.subscribe(sessionId, {
          onData: (chunk) => emit({ sessionId, kind: "data", chunk }),
          onExit: (exit) => {
            emit({ sessionId, kind: "exit", code: exit.code, signal: exit.signal });
            close();
          },
        });
        if (closed) unsubscribeTerminal();
        else unsubscribeDisconnect = hostEvents.onDisconnect(close);
        return { operation: "subscribe", accepted: true } satisfies TerminalSessionResult;
      }
    }
  };
  return Object.assign(capability, {
    captureStop() {
      if (captured) return captured;
      if (!bindings.size) return;
      captured = {
        id: ownerId,
        async stop() {
          if (disposed) throw new Error("The original terminal owner is no longer active.");
          closing = true;
          const stops = [...bindings].flatMap((id) => captureTerminalBindingStop(terminal, id, ownerId) ?? []);
          const results = await Promise.allSettled(stops.map((stop) => stop.stop()));
          const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
          if (failures.length) throw new AggregateError(failures, "Terminal owner stop could not be confirmed");
        },
      };
      return captured;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const close of subscriptions) close();
      ownedSessions.clear();
      bindings.clear();
      if (!closing) return terminal.killOwner(ownerId);
    },
  });
};
