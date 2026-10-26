import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { bridgeApiWebSockets, createApiProxy } from "./vite-api-credential";

const paths = ["/v1/terminal", "/v1/agents/authentication"];
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const startApi = () => {
  const api = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (request.headers.get("authorization") !== "Bearer api-token")
        return new Response("Unauthorized", { status: 401 });
      if (request.headers.get("origin")) return new Response("Forbidden", { status: 403 });
      if (server.upgrade(request)) return undefined;
      return new Response("ok");
    },
    websocket: {
      message(socket, message) {
        socket.send(`echo:${message}`);
      },
    },
  });
  cleanups.push(() => api.stop(true));
  return `http://127.0.0.1:${api.port}`;
};

const startDevServer = async (target: string) => {
  const server: Server = createServer((_request, response) => response.end("dashboard"));
  bridgeApiWebSockets(server, target, "api-token");
  server.on("connection", (socket) => cleanups.push(() => socket.destroy()));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Dev server has no port");
  return `127.0.0.1:${address.port}`;
};

const openTerminal = (host: string, origin: string, path = "/v1/terminal") =>
  new WebSocket(`ws://${host}${path}`, { headers: { origin } } as unknown as string[]);

describe("dev server API credential", () => {
  test.each(paths)("bridges %s to an API that requires a token", async (path) => {
    const host = await startDevServer(startApi());
    const socket = openTerminal(host, `http://${host}`, path);
    cleanups.push(() => socket.close());

    const reply = await new Promise<string>((resolve, reject) => {
      socket.addEventListener("open", () => socket.send("hello"));
      socket.addEventListener("message", (event) => resolve(String(event.data)));
      socket.addEventListener("error", () => reject(new Error("terminal bridge failed")));
    });

    expect(reply).toBe("echo:hello");
  });

  test.each(paths)("refuses %s from another site", async (path) => {
    const host = await startDevServer(startApi());
    const socket = openTerminal(host, "https://attacker.example", path);
    cleanups.push(() => socket.close());

    const opened = await new Promise<boolean>((resolve) => {
      socket.addEventListener("open", () => resolve(true));
      socket.addEventListener("error", () => resolve(false));
    });

    expect(opened).toBe(false);
  });

  test("adds the token to proxied API requests", () => {
    const proxy = createApiProxy("http://127.0.0.1:19841", "api-token");

    expect(proxy["/v1"]?.headers).toEqual({ authorization: "Bearer api-token" });
    expect(proxy["/healthz"]?.target).toBe("http://127.0.0.1:19841");
  });
});
