import { type ChildProcess, spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { request as proxyRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer, Socket } from "node:net";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type Connect, defineConfig } from "vite";

const packageRoot = import.meta.dirname;
const repoRoot = resolve(packageRoot, "../..");
const apiPrefix = "/__extension-testbench";

const reservePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      server.close(() => resolvePort(address.port));
    });
  });

const waitForPort = async (port: number) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const connected = await new Promise<boolean>((resolveConnection) => {
      const socket = new Socket();
      socket.once("connect", () => {
        socket.destroy();
        resolveConnection(true);
      });
      socket.once("error", () => resolveConnection(false));
      socket.connect(port, "127.0.0.1");
    });

    if (connected) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }

  throw new Error("Extension testbench API did not start.");
};

const startApiServer = async () => {
  const port = await reservePort();
  const child = spawn("bun", ["./src/lib/testbench-api-server.ts"], {
    cwd: packageRoot,
    env: { ...process.env, EXTENSION_TESTBENCH_API_PORT: String(port) },
    stdio: ["ignore", "inherit", "inherit"],
  });

  await waitForPort(port);
  return { child, port };
};

const proxyApiRequest = (port: number, request: IncomingMessage, reply: ServerResponse) => {
  const host = request.headers.host;
  const proxied = proxyRequest(
    {
      headers: {
        ...request.headers,
        ...(host ? { "x-pstdio-testbench-origin": `http://${host}` } : {}),
      },
      hostname: "127.0.0.1",
      method: request.method,
      path: request.url,
      port,
    },
    (response) => {
      reply.writeHead(response.statusCode ?? 500, response.headers);
      response.pipe(reply);
    },
  );

  proxied.once("error", (error) => {
    reply.statusCode = 502;
    reply.end(error instanceof Error ? error.message : String(error));
  });
  request.pipe(proxied);
};

const extensionTestbenchApi = () => {
  let child: ChildProcess | undefined;

  const registerMiddleware = async (server: {
    httpServer?: { once: (event: "close", listener: () => void) => void };
    middlewares: Connect.Server;
  }) => {
    const api = await startApiServer();
    child = api.child;

    server.httpServer?.once("close", () => child?.kill());
    server.middlewares.use((request, reply, next) => {
      if (!request.url?.startsWith(apiPrefix)) {
        next();
        return;
      }

      proxyApiRequest(api.port, request, reply);
    });
  };

  return {
    name: "pstdio-extension-testbench-api",
    configureServer: registerMiddleware,
    configurePreviewServer: registerMiddleware,
  };
};

export default defineConfig({
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@chakra-ui/react",
      "@emotion/react",
      "@emotion/styled",
    ],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  plugins: [react(), extensionTestbenchApi()],
});
