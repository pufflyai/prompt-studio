import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { connect, createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { readPerformanceEndpointDescriptor } from "pstdio-paths";
import { securePerformanceDirectory } from "./secure-performance-directory";

const isServing = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

// The credential file protects access on every platform. The listener accepts
// only loopback connections and never reads a snapshot before authenticating.
export const openPerformanceEndpoint = async (path: string, read: () => unknown) => {
  const previous = readPerformanceEndpointDescriptor(path);
  if (previous && (await isServing(previous.port))) {
    throw new Error("Another app is already serving performance diagnostics.");
  }
  rmSync(path, { force: true });
  securePerformanceDirectory(dirname(path));
  const token = randomBytes(32).toString("hex");
  const sockets = new Set<Socket>();
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.setTimeout(2_000, () => socket.destroy());
    let request = "";
    const authenticate = (chunk: string) => {
      if (request.length + chunk.length > token.length + 1) {
        socket.destroy();
        return;
      }
      request += chunk;
      if (!request.endsWith("\n")) return;
      socket.off("data", authenticate);
      if (request !== `${token}\n`) {
        socket.destroy();
        return;
      }
      socket.end(`${JSON.stringify(read())}\n`);
    };
    socket.on("data", authenticate);
    socket.on("end", () => socket.end());
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
