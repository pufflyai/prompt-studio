import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { bridgeTerminalWebSockets, createApiProxy } from "./vite-api-credential";

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
  bridgeTerminalWebSockets(server, target, "api-token");
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Dev server has no port");
  return `127.0.0.1:${address.port}`;
};

const openTerminal = (host: string, origin: string) =>
  new WebSocket(`ws://${host}/v1/terminal`, { headers: { origin } } as unknown as string[]);

describe("dev server API credential", () => {
  test("bridges the dashboard terminal to an API that requires a token", async () => {
    const host = await startDevServer(startApi());
    const socket = openTerminal(host, `http://${host}`);
    cleanups.push(() => socket.close());

    const reply = await new Promise<string>((resolve, reject) => {
      socket.addEventListener("open", () => socket.send("hello"));
      socket.addEventListener("message", (event) => resolve(String(event.data)));
      socket.addEventListener("error", () => reject(new Error("terminal bridge failed")));
    });

    expect(reply).toBe("echo:hello");
  });

  test("refuses a terminal request from another site", async () => {
    const host = await startDevServer(startApi());
    const socket = openTerminal(host, "https://attacker.example");
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
