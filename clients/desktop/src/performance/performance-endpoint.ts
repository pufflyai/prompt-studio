import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { connect, createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import type { ReactRenderCapture } from "pstdio-api-contracts/performance-diagnostics";
import { securePerformanceDirectory } from "pstdio-diagnostics";
import { readPerformanceEndpointDescriptor } from "pstdio-paths";

const isServing = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

interface RenderCaptureEndpoint {
  read: () => ReactRenderCapture | null;
  start: () => Promise<ReactRenderCapture>;
}

// The owner-only credential protects reads and the one bounded capture action.
export const openPerformanceEndpoint = async (path: string, read: () => unknown, renders?: RenderCaptureEndpoint) => {
  const previous = readPerformanceEndpointDescriptor(path);
  if (previous && (await isServing(previous.port))) {
    throw new Error("Another app is already serving performance diagnostics.");
  }
  rmSync(path, { force: true });
  await securePerformanceDirectory(dirname(path));
  const token = randomBytes(32).toString("hex");
  const sockets = new Set<Socket>();
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.setTimeout(2_000, () => socket.destroy());
    let request = "";
    const endUnauthenticated = () => socket.end();
    socket.once("end", endUnauthenticated);
    const authenticate = (chunk: string) => {
      if (request.length + chunk.length > token.length + " start-renders\n".length) {
        socket.destroy();
        return;
      }
      request += chunk;
      if (!request.endsWith("\n")) return;
      socket.off("data", authenticate);
      socket.off("end", endUnauthenticated);
      const reply = (value: unknown) => {
        if (!socket.destroyed) socket.end(`${JSON.stringify(value)}\n`);
      };
      if (request === `${token}\n`) reply(read());
      else if (request === `${token} renders\n` && renders) reply({ capture: renders.read() });
      else if (request === `${token} start-renders\n` && renders) {
        void Promise.resolve()
          .then(renders.start)
          .then(
            (capture) => reply({ capture }),
            (error) => reply({ error: (error instanceof Error ? error.message : String(error)).slice(0, 500) }),
          );
      } else {
        socket.destroy();
      }
    };
    socket.on("data", authenticate);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const close = () =>
    new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => {
        rmSync(path, { force: true });
        resolve();
      });
    });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Performance endpoint did not bind locally.");
    writeFileSync(path, JSON.stringify({ port: address.port, token }), { mode: 0o600, flag: "wx" });
  } catch (error) {
    await close();
    throw error;
  }
  return { close };
};
