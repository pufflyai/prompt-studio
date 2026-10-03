import { chmodSync, lstatSync, rmSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";

const isServing = (path: string) =>
  new Promise<boolean>((resolve) => {
    const socket = connect(path);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

// A crashed app cannot remove its socket file. Remove it only when nothing answers.
const removeStaleSocket = async (path: string) => {
  try {
    if (!lstatSync(path).isSocket()) return;
  } catch {
    return;
  }
  if (await isServing(path)) throw new Error("Another app is already serving performance diagnostics.");
  rmSync(path, { force: true });
};

const closeServer = (server: Server, sockets: Set<Socket>, path: string, socketFile: boolean) =>
  new Promise<void>((resolve) => {
    // A client that keeps its side open must not delay turning monitoring off or quitting.
    for (const socket of sockets) socket.destroy();
    server.close(() => {
      if (socketFile) rmSync(path, { force: true });
      resolve();
    });
  });

// Serves the local snapshot to `pst performance` on this device. It never reads
// requests: every connection receives the current snapshot and is closed.
export const openPerformanceEndpoint = async (path: string, read: () => unknown) => {
  const socketFile = process.platform !== "win32";
  if (socketFile) await removeStaleSocket(path);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.end(`${JSON.stringify(read())}\n`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => {
      server.off("error", reject);
      resolve();
    });
  });
  try {
    // Only the signed-in user may read it, matching what that user sees in the app.
    if (socketFile) chmodSync(path, 0o600);
  } catch (error) {
    await closeServer(server, sockets, path, socketFile);
    throw error;
  }
  return { close: () => closeServer(server, sockets, path, socketFile) };
};
