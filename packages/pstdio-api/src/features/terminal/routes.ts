import { OpenAPIHono } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import type { TerminalSessionHandle } from "pstdio-api-contracts/extension-kernel";
import type { AppBindings } from "../../types";
import type { TerminalRouteDeps } from "./deps";

/**
 * Browser-facing transport for the app PTY supervisor. Renderers open a session
 * over REST, stream output/exit through the SSE `events` endpoint (chunks are
 * base64 so binary PTY output survives JSON), and address stdin/geometry/kill
 * at the returned session id.
 */
export const createTerminalRoutes = (deps: TerminalRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const sessions = new Map<string, TerminalSessionHandle>();

  const closeSession = async (handle: TerminalSessionHandle) => {
    if (!sessions.delete(handle.id)) return;
    await handle.kill();
  };

  routes.post("/terminal/sessions", async (c) => {
    const terminal = deps.terminal;
    if (!terminal) return c.json({ error: "Terminal sessions are not available on this host." }, 503);

    const request = await c.req.json<{
      command?: string[];
      cwd?: string;
      env?: Record<string, string>;
      cols: number;
      rows: number;
    }>();

    const handle = terminal.openSession(request);
    sessions.set(handle.id, handle);
    return c.json({ sessionId: handle.id }, 201);
  });

  routes.get("/terminal/sessions/:id/events", (c) => {
    const handle = sessions.get(c.req.param("id"));
    if (!handle) return c.json({ error: "Unknown terminal session." }, 404);

    return streamSSE(c, async (stream) => {
      // Quiet PTYs would otherwise hit the server's idle timeout and lose the
      // stream; pings keep the connection alive and are ignored by clients.
      let aborted = false;
      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "ping", data: "{}" });
      }, 8_000);
      const abortSession = () => {
        if (aborted) return;
        aborted = true;
        clearInterval(heartbeat);
        void closeSession(handle).catch(() => undefined);
      };
      stream.onAbort(abortSession);
      c.req.raw.signal.addEventListener("abort", abortSession, { once: true });

      try {
        for await (const event of handle.events()) {
          if (aborted) return;

          if (event.kind === "data") {
            await stream.writeSSE({
              event: "data",
              data: JSON.stringify({ chunk: Buffer.from(event.chunk).toString("base64") }),
            });
            continue;
          }
          if (event.kind === "title") {
            await stream.writeSSE({ event: "title", data: JSON.stringify({ title: event.title }) });
            continue;
          }
          if (event.kind === "exit") {
            sessions.delete(handle.id);
            await stream.writeSSE({
              event: "exit",
              data: JSON.stringify({ code: event.code, signal: event.signal }),
            });
            return;
          }
          await stream.writeSSE({ event: "error", data: JSON.stringify({ message: event.message }) });
        }
      } finally {
        clearInterval(heartbeat);
        c.req.raw.signal.removeEventListener("abort", abortSession);
      }
    });
  });

  routes.post("/terminal/sessions/:id/write", async (c) => {
    const handle = sessions.get(c.req.param("id"));
    if (!handle) return c.json({ error: "Unknown terminal session." }, 404);

    const { data } = await c.req.json<{ data: string }>();
    handle.write(Buffer.from(data, "base64"));
    return c.json({ accepted: true });
  });

  routes.post("/terminal/sessions/:id/resize", async (c) => {
    const handle = sessions.get(c.req.param("id"));
    if (!handle) return c.json({ error: "Unknown terminal session." }, 404);

    const { cols, rows } = await c.req.json<{ cols: number; rows: number }>();
    handle.resize(cols, rows);
    return c.json({ accepted: true });
  });

  routes.delete("/terminal/sessions/:id", async (c) => {
    const handle = sessions.get(c.req.param("id"));
    if (!handle) return c.json({ error: "Unknown terminal session." }, 404);

    await closeSession(handle);
    return c.json({ accepted: true });
  });

  return routes;
};
