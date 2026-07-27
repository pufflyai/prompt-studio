import type { WorkbenchTerminalSessionExit, WorkbenchTerminalSessionOpener } from "@pstdio/workbench";
import type { TerminalWebSocketClientMessage, TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { buildAbsoluteApiUrl } from "@/lib/api";

const encodeBase64 = (data: string | Uint8Array) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const createChannel = <T>(replay: "queue" | "latest") => {
  const handlers = new Set<(value: T) => void>();
  const pending: T[] = [];

  return {
    emit(value: T) {
      if (handlers.size === 0) {
        if (replay === "queue") pending.push(value);
        else pending[0] = value;
        return;
      }
      for (const handler of handlers) handler(value);
    },
    subscribe(handler: (value: T) => void) {
      handlers.add(handler);
      while (pending.length > 0) handler(pending.shift() as T);
      return () => handlers.delete(handler);
    },
  };
};

const createSessionEventHub = () => {
  const data = createChannel<Uint8Array>("queue");
  const title = createChannel<string>("latest");
  const exit = createChannel<WorkbenchTerminalSessionExit>("latest");
  const errorHandlers = new Set<(error: { message: string }) => void>();

  return {
    dispatch(message: TerminalWebSocketServerMessage) {
      if (message.type === "data") data.emit(decodeBase64(message.chunk));
      else if (message.type === "title") title.emit(message.title);
      else if (message.type === "exit") exit.emit({ code: message.code, signal: message.signal });
      else if (message.type === "error") {
        for (const handler of errorHandlers) handler({ message: message.message });
      }
    },
    onData: data.subscribe,
    onTitle: title.subscribe,
    onExit: exit.subscribe,
    onError(handler: (error: { message: string }) => void) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
  };
};

const terminalWebSocketUrl = () => {
  const url = new URL(buildAbsoluteApiUrl("/v1/terminal"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

/** Opens a PTY over one bidirectional WebSocket, including stdin and resize. */
export const openDashboardTerminalSession: WorkbenchTerminalSessionOpener = (request) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(terminalWebSocketUrl());
    const hub = createSessionEventHub();
    let opened = false;

    const send = (message: TerminalWebSocketClientMessage) => socket.send(JSON.stringify(message));

    socket.addEventListener("open", () => send({ type: "open", request }));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
      if (message.type !== "open") {
        if (!opened && message.type === "error") reject(new Error(message.message));
        else hub.dispatch(message);
        return;
      }

      opened = true;
      resolve({
        id: message.sessionId,
        write(data) {
          send({ type: "write", data: encodeBase64(data) });
        },
        resize(cols, rows) {
          send({ type: "resize", cols, rows });
        },
        kill(signal) {
          if (socket.readyState === WebSocket.OPEN) send({ type: "kill", signal });
          socket.close();
        },
        onData: hub.onData,
        onTitle: hub.onTitle,
        onExit: hub.onExit,
        onError: hub.onError,
      });
    });
    socket.addEventListener("error", () => {
      if (!opened) reject(new Error("Could not open a terminal session."));
    });
    socket.addEventListener("close", (event) => {
      if (!opened) reject(new Error("The terminal connection closed before the session opened."));
      else if (!event.wasClean) hub.dispatch({ type: "error", message: "Terminal connection lost." });
    });
  });
