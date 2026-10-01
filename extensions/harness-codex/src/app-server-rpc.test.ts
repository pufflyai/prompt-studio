import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createServer, type Socket } from "node:net";
import { createAppServerRpc } from "./app-server-rpc";

test("RPC EOF rejects an outstanding request while its real TCP peer remains alive", async () => {
  let accept: (socket: Socket) => void;
  const connection = new Promise<Socket>((resolve) => {
    accept = resolve;
  });
  const server = createServer((socket) => accept(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listening address");
  const peer = `
    const net = require('node:net');
    const readline = require('node:readline');
    const socket = net.connect(Number(process.argv[1]), '127.0.0.1');
    readline.createInterface({input: socket}).on('line', line => {
      const request = JSON.parse(line);
      if (request.method === 'initialize') socket.write(JSON.stringify({id: request.id, result: {}}) + '\\n');
      else socket.end();
    });
    setInterval(() => {}, 1000);
  `;
  const child = spawn("node", ["-e", peer, String(address.port)], { stdio: "pipe" });
  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const socket = await connection;
  const rpc = createAppServerRpc(
    {
      stdin: socket,
      stdout: socket,
      stderr: child.stderr!,
      kill: () => {
        child.kill();
      },
      onExit,
    },
    () => {},
  );
  try {
    await rpc.request("initialize", {});
    const pending = rpc.request("hold", {});
    const rejected = expect(pending).rejects.toThrow("connection closed");
    expect(await Promise.race([rpc.finished.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    await rejected;
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
  } finally {
    socket.destroy();
    child.kill();
    await onExit;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
