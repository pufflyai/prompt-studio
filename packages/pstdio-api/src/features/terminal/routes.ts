import { OpenAPIHono } from "@hono/zod-openapi";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext, WSEvents } from "hono/ws";
import type {
  TerminalEvent,
  TerminalSessionHandle,
  TerminalSessionRequest,
  TerminalViewOpenRequest,
  TerminalWebSocketClientMessage,
  TerminalWebSocketServerMessage,
} from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import type { TerminalRouteDeps } from "./deps";
import { nativeTerminalOpenSchema, openNativeTerminalSession } from "./native-terminal-session";
import {
  createRetainedTerminals,
  type RetainedTerminal,
  type RetainedTerminals,
  type TerminalAttachment,
} from "./retained-terminals";

interface TerminalRouteOptions {
  allowedOrigins?: string[];
}

export const isTerminalWebSocketOriginAllowed = (request: Request, allowedOrigins: string[] = []) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin || allowedOrigins.includes(origin);
};

const sendMessage = (socket: WSContext, message: TerminalWebSocketServerMessage) => {
  socket.send(JSON.stringify(message));
};

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

type TerminalSocketDeps = Pick<TerminalRouteDeps, "terminal"> & {
  openView?(request: TerminalViewOpenRequest, signal: AbortSignal): Promise<TerminalSessionHandle>;
  retained?: RetainedTerminals;
};
export const createTerminalWebSocketEvents = (deps: TerminalSocketDeps): WSEvents => {
  let session: TerminalSessionHandle | undefined;
  let retained: { terminal: RetainedTerminal; attachment: TerminalAttachment } | undefined;
  let accepting = true;
  let closed = false;
  const lifetime = new AbortController();

  const closeSession = async (signal?: string) => {
    closed = true;
    accepting = false;
    lifetime.abort();
    const activeSession = session;
    const retainedSession = retained;
    session = undefined;
    retained = undefined;
    if (retainedSession && deps.retained) await deps.retained.kill(retainedSession.terminal, signal);
    else await activeSession?.kill(signal as NodeJS.Signals | undefined);
  };

  // A retained terminal keeps running when its socket goes away; only a kill message ends it.
  const releaseSocket = () => {
    if (!retained || !deps.retained) {
      void closeSession();
      return;
    }
    closed = true;
    accepting = false;
    lifetime.abort();
    deps.retained.detach(retained.terminal, retained.attachment);
    session = undefined;
    retained = undefined;
  };

  const sendEvent = (event: TerminalEvent, socket: WSContext) => {
    if (event.kind === "data") {
      sendMessage(socket, { type: "data", chunk: Buffer.from(event.chunk).toString("base64") });
    } else if (event.kind === "title") {
      sendMessage(socket, { type: "title", title: event.title });
    } else if (event.kind === "error") {
      sendMessage(socket, { type: "error", message: event.message });
    } else {
      session = undefined;
      retained = undefined;
      sendMessage(socket, { type: "exit", code: event.code, signal: event.signal });
      socket.close(1000);
    }
  };

  const openRetained = (
    terminal: NonNullable<TerminalRouteDeps["terminal"]>,
    registry: RetainedTerminals,
    request: TerminalSessionRequest,
    attachKey: string,
    socket: WSContext,
  ) => {
    const attachment: TerminalAttachment = {
      event: (event) => sendEvent(event, socket),
      fail: (failure) => {
        session = undefined;
        retained = undefined;
        sendMessage(socket, { type: "error", message: failure });
        socket.close(1011, "Terminal session failed");
      },
    };
    const attached = registry.attach(attachKey, attachment);
    if (attached) {
      session = attached.terminal.session;
      retained = { terminal: attached.terminal, attachment };
      sendMessage(socket, { type: "open", sessionId: session.id });
      if (attached.backlog.byteLength > 0) sendEvent({ kind: "data", chunk: attached.backlog }, socket);
      session.resize(request.cols, request.rows);
      return;
    }
    const opened = terminal.openSession(request);
    session = opened;
    sendMessage(socket, { type: "open", sessionId: opened.id });
    retained = { terminal: registry.retain(attachKey, opened, attachment), attachment };
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
      sendMessage(socket, { type: "error", message: errorMessage(cause) });
      await closeSession();
      socket.close(1011, "Terminal session failed");
    }
  };

  const openView = (request: TerminalViewOpenRequest, socket: WSContext) => {
    try {
      if (!deps.openView) throw new Error("Native terminal views are not available on this host");
      const opening = deps.openView(nativeTerminalOpenSchema.parse(request), lifetime.signal);
      void opening
        .then(async (accepted) => {
          if (closed) {
            await accepted.kill();
            return;
          }
          session = accepted;
          sendMessage(socket, { type: "open", sessionId: accepted.id });
          void pumpSessionEvents(accepted, socket);
        })
        .catch((cause) => {
          if (closed) return;
          sendMessage(socket, { type: "error", message: errorMessage(cause) });
          void closeSession().finally(() => socket.close(1011, "Terminal session failed"));
        });
    } catch (cause) {
      sendMessage(socket, { type: "error", message: errorMessage(cause) });
      void closeSession().finally(() => socket.close(1011, "Terminal session failed"));
    }
  };

  const openTerminal = (message: TerminalWebSocketClientMessage & { type: "open" }, socket: WSContext) => {
    if (!deps.terminal) {
      sendMessage(socket, { type: "error", message: "Terminal sessions are not available on this host." });
      socket.close(1011, "Terminal unavailable");
      return;
    }
    try {
      if (message.attachKey && deps.retained) {
        openRetained(deps.terminal, deps.retained, message.request, message.attachKey, socket);
        return;
      }
      session = deps.terminal.openSession(message.request);
    } catch (cause) {
      sendMessage(socket, { type: "error", message: errorMessage(cause) });
      socket.close(1011, "Terminal session failed");
      return;
    }
    sendMessage(socket, { type: "open", sessionId: session.id });
    void pumpSessionEvents(session, socket);
  };

  return {
    onMessage(event, socket) {
      const message = JSON.parse(String(event.data)) as TerminalWebSocketClientMessage;

      if (message.type === "open" || message.type === "openView") {
        if (!accepting) {
          sendMessage(socket, { type: "error", message: "This terminal socket already has an owner" });
          void closeSession().finally(() => socket.close(1008));
          return;
        }
        accepting = false;
        if (message.type === "openView") {
          openView(message.request, socket);
          return;
        }
        openTerminal(message, socket);
      } else if (message.type === "write") {
        session?.write(Buffer.from(message.data, "base64"));
      } else if (message.type === "resize") {
        session?.resize(message.cols, message.rows);
      } else {
        void closeSession(message.signal).finally(() => socket.close(1000));
      }
    },
    onClose() {
      releaseSocket();
    },
    onError() {
      releaseSocket();
    },
  };
};

/**
 * One bidirectional WebSocket drives one PTY session. Without an attach key the socket owns the
 * session's whole lifecycle; with one, the session outlives the socket until it is killed or exits.
 */
export const createTerminalRoutes = (deps: TerminalRouteDeps, options: TerminalRouteOptions = {}) => {
  const routes = new OpenAPIHono<AppBindings>();
  const retained = createRetainedTerminals();
  routes.use("/terminal", async (context, next) => {
    if (!isTerminalWebSocketOriginAllowed(context.req.raw, options.allowedOrigins)) {
      return context.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
  routes.get(
    "/terminal",
    upgradeWebSocket(() =>
      createTerminalWebSocketEvents({
        terminal: deps.terminal,
        openView: (request, signal) => openNativeTerminalSession(deps, request, signal),
        retained,
      }),
    ),
  );
  return routes;
};
