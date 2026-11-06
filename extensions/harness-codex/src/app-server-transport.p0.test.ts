import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createServer, type Socket } from "node:net";
import { createAppServerTransport } from "./app-server-transport";

test("a final response and turn completion drain before an exited server disconnects its owner", async () => {
  const accepted = Promise.withResolvers<Socket>();
  const server = createServer((socket) => accepted.resolve(socket));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listening address");
  const peer = `
    const socket = require('node:net').connect(Number(process.argv[1]), '127.0.0.1');
    require('node:readline').createInterface({ input: socket }).on('line', line => {
      const request = JSON.parse(line);
      const response = JSON.stringify({ id: request.id, result: { ok: true } }) + '\\n';
      if (request.method !== 'finish') { socket.write(response); return; }
      const completed = JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread' } }) + '\\n';
      socket.end(response + completed, () => process.exit(0));
    });
  `;
  const child = spawn("node", ["-e", peer, String(address.port)], { stdio: "pipe" });
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const socket = await accepted.promise;
  const transport = createAppServerTransport(
    {},
    {
      spawnProcess: () => ({
        stdin: socket,
        stdout: socket,
        stderr: child.stderr,
        kill: () => {
          child.kill();
        },
        onExit: exited,
      }),
    },
  );
  const delivered: string[] = [];
  const owner = {
    receive: (message: { method?: string }) => delivered.push(message.method!),
    disconnect: () => delivered.push("disconnected"),
  };
  transport.retain(owner);
  transport.claim("thread", "session", owner);
  try {
    await transport.ready;
    // A busy host can observe process exit before reading the last protocol bytes.
    socket.pause();
    const response = transport.request("finish", {}).then(
      (result) => ({ result }),
      (error) => ({ error: String(error) }),
    );
    await exited;
    socket.resume();
    await transport.finished;
    expect(await response).toEqual({ result: { ok: true } });
    expect(delivered).toEqual(["turn/completed", "disconnected"]);
  } finally {
    socket.resume();
    socket.destroy();
    await transport.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
