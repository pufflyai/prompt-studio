import { OpenAPIHono } from "@hono/zod-openapi";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext, WSEvents } from "hono/ws";
import type {
  TerminalSessionHandle,
  TerminalWebSocketClientMessage,
  TerminalWebSocketServerMessage,
} from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import type { TerminalRouteDeps } from "./deps";

const sendMessage = (socket: WSContext, message: TerminalWebSocketServerMessage) => {
  socket.send(JSON.stringify(message));
};

export const createTerminalWebSocketEvents = (deps: TerminalRouteDeps): WSEvents => {
  let session: TerminalSessionHandle | undefined;

  const closeSession = async (signal?: string) => {
    const activeSession = session;
    session = undefined;
    await activeSession?.kill(signal as NodeJS.Signals | undefined);
  };

  const pumpSessionEvents = async (activeSession: TerminalSessionHandle, socket: WSContext) => {
    try {
      for await (const event of activeSession.events()) {
        if (session !== activeSession) return;

        if (event.kind === "data") {
          sendMessage(socket, { type: "data", chunk: Buffer.from(event.chunk).toString("base64") });
        } else if (event.kind === "title") {
          sendMessage(socket, { type: "title", title: event.title });
        } else if (event.kind === "error") {
          sendMessage(socket, { type: "error", message: event.message });
        } else {
          session = undefined;
          sendMessage(socket, { type: "exit", code: event.code, signal: event.signal });
          socket.close(1000);
        }
      }
    } catch (cause) {
      if (session !== activeSession) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      sendMessage(socket, { type: "error", message });
      await closeSession();
      socket.close(1011, "Terminal session failed");
    }
  };

  return {
    onMessage(event, socket) {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketClientMessage;

      if (message.type === "open") {
        if (!deps.terminal) {
          sendMessage(socket, { type: "error", message: "Terminal sessions are not available on this host." });
          socket.close(1011, "Terminal unavailable");
          return;
        }

        session = deps.terminal.openSession(message.request);
        sendMessage(socket, { type: "open", sessionId: session.id });
        void pumpSessionEvents(session, socket);
      } else if (message.type === "write") {
        session?.write(Buffer.from(message.data, "base64"));
      } else if (message.type === "resize") {
        session?.resize(message.cols, message.rows);
      } else {
        void closeSession(message.signal).finally(() => socket.close(1000));
      }
    },
    onClose() {
      void closeSession();
    },
    onError() {
      void closeSession();
    },
  };
};

/** One bidirectional WebSocket owns one PTY session and its full lifecycle. */
export const createTerminalRoutes = (deps: TerminalRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.get(
    "/terminal",
    upgradeWebSocket(() => createTerminalWebSocketEvents(deps)),
  );
  return routes;
};
