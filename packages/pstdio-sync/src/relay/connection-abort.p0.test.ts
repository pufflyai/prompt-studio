import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { createRelaySocket } from "./connection";

test.each([
  false,
  true,
])("local abort drains admitted work without waiting for a peer close reply: %s", async (held) => {
  const controller = new AbortController();
  const opened = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let peer: Socket | undefined;
  let finished = false;
  let settled = false;
  const server = createServer((socket) => {
    peer = socket;
    socket.once("data", (request) => {
      const key = request.toString().match(/Sec-WebSocket-Key: (.+)\r\n/i)![1];
      const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      const ready = Buffer.from(JSON.stringify({ type: "ready" }));
      socket.write(Buffer.concat([Buffer.from([0x81, ready.length]), ready]));
    });
    // A real upgraded peer deliberately sends no WebSocket close response.
    socket.on("error", () => {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const connection = createRelaySocket({
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    path: "/live",
    access: async () => ({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    signal: controller.signal,
    message: () => "ready",
    synchronize: async () => {
      opened.resolve();
      if (held) await release.promise;
      finished = true;
    },
  });
  void connection.done.then(() => {
    settled = true;
  });
  try {
    await opened.promise;
    controller.abort();
    if (held) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).toBe(false);
      expect(finished).toBe(false);
    }
    release.resolve();
    const result = await Promise.race([connection.done.then(() => "closed"), Bun.sleep(1_000).then(() => "blocked")]);
    expect(result).toBe("closed");
    expect(finished).toBe(true);
    expect(connection.status().connected).toBe(false);
  } finally {
    release.resolve();
    controller.abort();
    peer?.destroy();
    await connection.done;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
