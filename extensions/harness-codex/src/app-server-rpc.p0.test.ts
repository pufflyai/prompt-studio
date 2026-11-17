import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createServer, type Socket } from "node:net";
import { PassThrough } from "node:stream";
import { createAppServerRpc } from "./app-server-rpc";

test("RPC preserves Unicode separators and UTF-8 across chunks in responses and notifications", async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const notifications: unknown[] = [];
  const delivered: unknown[] = [];
  const rpc = createAppServerRpc(
    { stdin, stdout, stderr, kill: () => {}, onExit: Promise.resolve({ code: 0, signal: null }) },
    (message) => {
      notifications.push(message);
      delivered.push("notification");
    },
  );
  const text = "First section\u2028+\u2029Second section 🎨";
  const response = { text };
  const notification = { method: "item/completed", params: { text } };
  const pending = rpc.request("thread/read", {}, () => delivered.push("response"));
  const outcome = pending.then(
    (result) => ({ result }),
    (error: unknown) => ({ error }),
  );
  const bytes = Buffer.from(`${JSON.stringify({ id: 1, result: response })}\r\n${JSON.stringify(notification)}\n`);
  // Split both a Unicode separator and a four-byte character between stream chunks.
  const separator = bytes.indexOf(Buffer.from("\u2028"));
  const emoji = bytes.indexOf(Buffer.from("🎨"));
  try {
    stdout.write(bytes.subarray(0, separator + 1));
    stdout.write(bytes.subarray(separator + 1, emoji + 2));
    stdout.end(bytes.subarray(emoji + 2));
    await rpc.finished;
    expect(await outcome).toEqual({ result: response });
    expect(notifications).toEqual([notification]);
    expect(delivered).toEqual(["response", "notification"]);
  } finally {
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
  }
});

test("RPC drains a final response without a newline before rejecting requests at EOF", async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const rpc = createAppServerRpc(
    { stdin, stdout, stderr, kill: () => {}, onExit: Promise.resolve({ code: 0, signal: null }) },
    () => {},
  );
  const result = rpc.request("thread/read", {});
  const held = rpc.request("hold", {}).catch((error: unknown) => error);
  stdout.end(JSON.stringify({ id: 1, result: { text: "saved" } }));
  await rpc.finished;
  expect(await result).toEqual({ text: "saved" });
  expect(await held).toMatchObject({ message: expect.stringContaining("connection closed") });
  stdin.destroy();
  stderr.destroy();
});

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
    const rejected = pending.catch((error: unknown) => error);
    expect(await Promise.race([rpc.finished.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    expect(await rejected).toMatchObject({ message: expect.stringContaining("connection closed") });
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
  } finally {
    socket.destroy();
    child.kill();
    await onExit;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("RPC delivers a large fragmented history response before its following notification", async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const delivered: string[] = [];
  const rpc = createAppServerRpc(
    { stdin, stdout, stderr, kill: () => {}, onExit: Promise.resolve({ code: 0, signal: null }) },
    () => delivered.push("notification"),
  );
  const response = { text: "x".repeat(8 * 1024 * 1024) };
  const pending = rpc.request("thread/read", {}, () => delivered.push("response"));
  const bytes = Buffer.from(
    `${JSON.stringify({ id: 1, result: response })}\n${JSON.stringify({ method: "item/completed" })}\n`,
  );
  try {
    for (let offset = 0; offset < bytes.length; offset += 64) stdout.write(bytes.subarray(offset, offset + 64));
    stdout.end();
    await rpc.finished;
    expect(await pending).toEqual(response);
    expect(delivered).toEqual(["response", "notification"]);
  } finally {
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
  }
});
