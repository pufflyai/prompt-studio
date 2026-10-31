import { afterEach, expect, test } from "bun:test";
import { syncPath } from "pstdio-sync-contracts";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

const NativeWebSocket = globalThis.WebSocket as {
  new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket;
};

const peers = new Set<ReturnType<typeof createPackagedSyncPeer>>();
const createPeer = () => {
  const peer = createPackagedSyncPeer(undefined);
  peers.add(peer);
  return peer;
};
const stopPeer = async (peer: ReturnType<typeof createPackagedSyncPeer>) => {
  await peer.stop();
  peers.delete(peer);
};
afterEach(async () => {
  // A timed-out test cannot reach a finally block behind its pending read.
  const results = await Promise.allSettled([...peers].map(stopPeer));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Peer cleanup failed",
    );
});

const enrolledAccess = async (origin: string, deviceId: string, workbenchId: string) => {
  const enrolled = await fetch(`${origin}/v1/device-login`, {
    method: "POST",
    body: JSON.stringify({ deviceId, name: `Device ${deviceId}` }),
  });
  expect(enrolled.ok).toBe(true);
  const device = (await enrolled.json()) as { token: string };
  const issued = await fetch(`${origin}/v1/environment-access`, {
    method: "POST",
    headers: { authorization: `Bearer ${device.token}` },
    body: JSON.stringify({ workbenchId }),
  });
  expect(issued.ok).toBe(true);
  const access = (await issued.json()) as { token: string };
  return { credential: device.token, token: access.token };
};

test("relay fixture access preserves the enrolled device and project identity", async () => {
  const peer = createPeer();
  try {
    const projectId = "project / encoded";
    const first = await enrolledAccess(peer.origin, "first", projectId);
    const second = await enrolledAccess(peer.origin, "second", projectId);
    const otherProject = await enrolledAccess(peer.origin, "first", "other-project");
    expect(first.credential).not.toBe(second.credential);
    expect(first.token).not.toBe(second.token);
    expect(first.token).not.toBe(otherProject.token);
    const documentId = "records_0123456789abcdef";
    const read = (projectId: string) =>
      `${peer.origin}${syncPath({ kind: "document", projectId, spaceOwner: null, documentId, operation: "read" })}`;
    const accepted = await fetch(read(projectId), {
      method: "POST",
      headers: { authorization: `Bearer ${first.token}`, "pstdio-sync-protocol": "1" },
      body: JSON.stringify({ after: 0 }),
    });
    expect(accepted.status).toBe(200);
    const denied = await fetch(read("other-project"), {
      method: "POST",
      headers: { authorization: `Bearer ${first.token}`, "pstdio-sync-protocol": "1" },
      body: JSON.stringify({ after: 0 }),
    });
    expect(denied.status).toBe(403);
  } finally {
    await stopPeer(peer);
  }
});

test("relay fixture forwards volatile frames with the authenticated sender without writing documents", async () => {
  const peer = createPeer();
  const sockets: WebSocket[] = [];
  const connect = async (deviceId: string) => {
    const { token } = await enrolledAccess(peer.origin, deviceId, "project");
    const socket = new NativeWebSocket(
      `${peer.origin.replace("http:", "ws:")}${syncPath({ kind: "live", projectId: "project" })}`,
      {
        headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1" },
      },
    );
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("message", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return socket;
  };
  try {
    const first = await connect("first");
    const second = await connect("second");
    const received = new Promise<unknown>((resolve) => {
      second.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true });
    });
    const payload = Buffer.from("volatile fixture frame").toString("base64");
    first.send(JSON.stringify({ type: "live", spaceOwner: null, payload }));
    expect(await received).toEqual({ type: "live", deviceId: "first", spaceOwner: null, payload });
    expect(peer.documents.size).toBe(0);
    expect(peer.states()).toBe(0);
    expect(peer.blobContents()).toHaveLength(0);
  } finally {
    for (const socket of sockets) socket.close();
    await stopPeer(peer);
  }
});

test("an unchanged relay announcement makes a connected peer read without adding edits", async () => {
  const peer = createPeer();
  const { token } = await enrolledAccess(peer.origin, "reader", "project");
  const documentId = "records_0123456789abcdef";
  peer.documents.set(`~${documentId}`, { state: null, updates: [] });
  const socket = new NativeWebSocket(
    `${peer.origin.replace("http:", "ws:")}${syncPath({ kind: "live", projectId: "project" })}`,
    {
      headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1" },
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("message", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const read = new Promise<unknown>((resolve, reject) => {
      socket.addEventListener(
        "message",
        async (event) => {
          try {
            const message = JSON.parse(String(event.data));
            expect(message).toMatchObject({ type: "changed", documentId, lastSequence: 0 });
            const response = await fetch(
              `${peer.origin}${syncPath({ kind: "document", projectId: "project", spaceOwner: null, documentId, operation: "read" })}`,
              {
                method: "POST",
                headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1" },
                body: JSON.stringify({ after: 0 }),
              },
            );
            resolve(await response.json());
          } catch (error) {
            reject(error);
          }
        },
        { once: true },
      );
    });
    const before = peer.reads();
    peer.announceUnchanged();
    expect(await read).toMatchObject({ updates: [], lastSequence: 0 });
    expect(peer.reads()).toBe(before + 1);
    expect(peer.states()).toBe(0);
    expect(peer.documents.get(`~${documentId}`)?.updates).toHaveLength(0);
  } finally {
    socket.close();
    await stopPeer(peer);
  }
});
