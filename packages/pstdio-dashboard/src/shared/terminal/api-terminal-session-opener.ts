import type { WorkbenchTerminalSessionExit, WorkbenchTerminalSessionOpener } from "@pstdio/workbench";
import type { TerminalWebSocketClientMessage, TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { buildAbsoluteApiUrl, readRuntimeConfig } from "@/lib/api";
import { browserSessionWebSocketProtocols, readBrowserSession } from "@/lib/browser-session";

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
  const configuredUrl = readRuntimeConfig()?.terminalWebSocketUrl;
  if (configuredUrl) return configuredUrl;

  const url = new URL(buildAbsoluteApiUrl("/v1/terminal"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

/**
 * Opens a PTY over one bidirectional WebSocket, including stdin and resize. With an attach key the
 * PTY outlives the socket: `detach` leaves it running, and the next open with that key resumes it.
 */
export const openDashboardTerminalSession = (
  request: Parameters<WorkbenchTerminalSessionOpener>[0],
  view?: Parameters<WorkbenchTerminalSessionOpener>[1],
  signal?: Parameters<WorkbenchTerminalSessionOpener>[2],
  attachKey?: string,
): ReturnType<WorkbenchTerminalSessionOpener> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const url = terminalWebSocketUrl();
    const socket = new WebSocket(url, browserSessionWebSocketProtocols(readBrowserSession(url)));
    const hub = createSessionEventHub();
    let opened = false;
    const releaseAdmission = () => signal?.removeEventListener("abort", cancelAdmission);
    const cancelAdmission = () => {
      releaseAdmission();
      reject(signal?.reason);
      socket.close();
    };
    signal?.addEventListener("abort", cancelAdmission, { once: true });

    const send = (message: TerminalWebSocketClientMessage) => socket.send(JSON.stringify(message));

    socket.addEventListener("open", () =>
      send(
        view
          ? { type: "openView", request: { ...view, cols: request.cols, rows: request.rows } }
          : { type: "open", request, ...(attachKey ? { attachKey } : {}) },
      ),
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketServerMessage;
      if (message.type !== "open") {
        if (!opened && message.type === "error") {
          releaseAdmission();
          socket.close();
          reject(new Error(message.message));
        } else hub.dispatch(message);
        return;
      }

      opened = true;
      releaseAdmission();
      let detached = false;
      resolve({
        id: message.sessionId,
        write(data) {
          send({ type: "write", data: encodeBase64(data) });
        },
        resize(cols, rows) {
          send({ type: "resize", cols, rows });
        },
        kill(signal) {
          if (detached) return;
          if (socket.readyState === WebSocket.OPEN) send({ type: "kill", signal });
          socket.close();
        },
        ...(attachKey
          ? {
              detach() {
                detached = true;
                socket.close();
              },
            }
          : {}),
        onData: hub.onData,
        onTitle: hub.onTitle,
        onExit: hub.onExit,
        onError: hub.onError,
      });
    });
    socket.addEventListener("error", () => {
      releaseAdmission();
      if (!opened) reject(new Error("Could not open a terminal session."));
    });
    socket.addEventListener("close", (event) => {
      releaseAdmission();
      if (!opened) reject(new Error("The terminal connection closed before the session opened."));
      else if (!event.wasClean) hub.dispatch({ type: "error", message: "Terminal connection lost." });
    });
  });
