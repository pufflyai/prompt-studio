import { afterEach, expect, test } from "bun:test";
import {
  liveProtocolHeader,
  liveProtocolVersion,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
} from "pstdio-sync-contracts";
import { createDeviceCommandPeer } from "./packaged-device-commands.fixture";

const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };
const peers = new Set<ReturnType<typeof createDeviceCommandPeer>>();
afterEach(async () => {
  await Promise.all([...peers].map((peer) => peer.close()));
  peers.clear();
});

const enrollment = async (origin: string, deviceId: string, workbenchId: string) => {
  const login = await fetch(`${origin}/v1/device-login`, {
    method: "POST",
    body: JSON.stringify({ deviceId, name: deviceId }),
  });
  expect(login.status).toBe(200);
  const credential = (await login.json()).token as string;
  const response = await fetch(`${origin}/v1/environment-access`, {
    method: "POST",
    headers: { authorization: `Bearer ${credential}` },
    body: JSON.stringify({ workbenchId }),
  });
  expect(response.status).toBe(200);
  return { credential, token: (await response.json()).token as string };
};

test("device-command peer carries enrolled device and project identity through durable and live requests", async () => {
  const peer = createDeviceCommandPeer(undefined);
  peers.add(peer);
  const sockets: WebSocket[] = [];
  try {
    const projectId = "project / encoded";
    const first = await enrollment(peer.origin, "first", projectId);
    const second = await enrollment(peer.origin, "second", projectId);
    expect(first.credential).not.toBe(second.credential);
    expect(first.token).not.toBe(second.token);
    const route = (projectId: string, operation: "read" | "updates" = "read") =>
      `${peer.origin}${syncPath({ kind: "document", projectId, spaceOwner: "owner", documentId: "records_0123456789abcdef", operation })}`;
    const request = (url: string, token: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, [syncProtocolHeader]: String(syncProtocolVersion) },
        body: JSON.stringify(body),
      });
    expect((await request(route(projectId), first.token, { after: 0 })).status).toBe(200);
    expect((await request(route("other-project"), first.token, { after: 0 })).status).toBe(403);
    expect((await request(route(projectId), "unknown", { after: 0 })).status).toBe(403);
    expect((await request(route(projectId), first.credential, { after: 0 })).status).toBe(403);
    const written = await request(route(projectId, "updates"), first.token, {
      updateId: "update_0123456789abcdef",
      payload: "Y2lwaGVydGV4dA==",
      blobIds: [],
    });
    expect(written.status).toBe(200);
    const read = await request(route(projectId), second.token, { after: 0 });
    expect((await read.json()).updates[0]).toMatchObject({ deviceId: "first" });
    const liveUrl = (id: string) => `${peer.origin}${syncPath({ kind: "live", projectId: id })}`;
    for (const token of ["unknown", first.credential])
      expect((await fetch(liveUrl(projectId), { headers: { authorization: `Bearer ${token}` } })).status).toBe(403);
    expect(
      (await fetch(liveUrl("other-project"), { headers: { authorization: `Bearer ${first.token}` } })).status,
    ).toBe(403);
    const connect = async (token: string) => {
      const socket = new NativeWebSocket(liveUrl(projectId).replace("http:", "ws:"), {
        headers: {
          authorization: `Bearer ${token}`,
          [syncProtocolHeader]: String(syncProtocolVersion),
          [liveProtocolHeader]: String(liveProtocolVersion),
        },
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("message", () => resolve(), { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
      const subscribed = new Promise<void>((resolve) =>
        socket.addEventListener("message", () => resolve(), { once: true }),
      );
      socket.send(
        JSON.stringify({
          type: "subscribe",
          spaceOwner: "owner",
          topic: "presence_0123456789abcdef",
          requestId: "subscribe",
        }),
      );
      await subscribed;
      return socket;
    };
    const sender = await connect(first.token);
    const receiver = await connect(second.token);
    const received = new Promise<unknown>((resolve) =>
      receiver.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true }),
    );
    sender.send(
      JSON.stringify({
        type: "publish",
        spaceOwner: "owner",
        topic: "presence_0123456789abcdef",
        payload: "Y2lwaGVydGV4dA==",
      }),
    );
    expect(await received).toMatchObject({ type: "event", deviceId: "first", payload: "Y2lwaGVydGV4dA==" });
  } finally {
    for (const socket of sockets) socket.close();
  }
});

// Preserve the delivered private-history scope regression from PR1745.
test("device command peer preserves scoped relay access when forwarding durable history", async () => {
  const peer = createDeviceCommandPeer(undefined);
  try {
    const projectId = "history / project";
    const login = await fetch(`${peer.origin}/v1/device-login`, {
      method: "POST",
      body: JSON.stringify({ deviceId: "reader", name: "Reader" }),
    });
    expect(login.ok).toBe(true);
    const credential = (await login.json()).token;
    const issued = await fetch(`${peer.origin}/v1/environment-access`, {
      method: "POST",
      headers: { authorization: `Bearer ${credential}` },
      body: JSON.stringify({ workbenchId: projectId }),
    });
    expect(issued.ok).toBe(true);
    const access = (await issued.json()).token;
    const read = (projectId: string, spaceOwner: string | null) =>
      fetch(
        `${peer.origin}${syncPath({ kind: "document", projectId, spaceOwner, documentId: "history_0123456789", operation: "read" })}`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${access}`, "pstdio-sync-protocol": "1" },
          body: JSON.stringify({ after: 0 }),
        },
      );
    expect((await read(projectId, "owner")).status).toBe(200);
    expect((await read("another-project", "owner")).status).toBe(403);
    expect((await read(projectId, "another-account")).status).toBe(403);
  } finally {
    await peer.close();
  }
});
