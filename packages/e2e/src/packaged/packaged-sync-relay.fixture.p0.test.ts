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
  const topic = "presence_0123456789abcdef";
  const connect = async (deviceId: string, projectId = "project", selectedTopic = topic) => {
    const { token } = await enrolledAccess(peer.origin, deviceId, projectId);
    const socket = new NativeWebSocket(
      `${peer.origin.replace("http:", "ws:")}${syncPath({ kind: "live", projectId })}`,
      {
        headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1", "pstdio-live-protocol": "2" },
      },
    );
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("message", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const subscribed = new Promise<void>((resolve) =>
      socket.addEventListener("message", () => resolve(), { once: true }),
    );
    socket.send(JSON.stringify({ type: "subscribe", spaceOwner: null, topic: selectedTopic, requestId: "subscribe" }));
    await subscribed;
    return socket;
  };
  try {
    const first = await connect("first");
    const second = await connect("second");
    const excluded = [
      await connect("other-project", "other-project"),
      await connect("other-topic", "project", "another_0123456789"),
    ];
    const unexpected: unknown[] = [];
    for (const socket of excluded)
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "event") unexpected.push(message);
      });
    const received = new Promise<unknown>((resolve) => {
      second.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true });
    });
    const payload = Buffer.from("volatile fixture frame").toString("base64");
    first.send(JSON.stringify({ type: "publish", spaceOwner: null, topic, payload }));
    expect(await received).toEqual({ type: "event", deviceId: "first", spaceOwner: null, topic, payload });
    for (const socket of excluded) {
      const barrier = new Promise<void>((resolve) =>
        socket.addEventListener("message", () => resolve(), { once: true }),
      );
      socket.send(JSON.stringify({ type: "follow", spaceOwner: null, topic }));
      await barrier;
    }
    expect(unexpected).toEqual([]);
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
      headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1", "pstdio-live-protocol": "2" },
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("message", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const subscribed = new Promise<void>((resolve) =>
      socket.addEventListener("message", () => resolve(), { once: true }),
    );
    socket.send(JSON.stringify({ type: "subscribe", spaceOwner: null, topic: documentId, requestId: "subscribe" }));
    await subscribed;
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

const documentRequests = async (peer: ReturnType<typeof createPackagedSyncPeer>, deviceId = "writer") => {
  const projectId = "fixture-project";
  const documentId = "records_fixture_0123456789";
  const { token } = await enrolledAccess(peer.origin, deviceId, projectId);
  const request = (operation: "read" | "updates" | "state", body: unknown) =>
    fetch(`${peer.origin}${syncPath({ kind: "document", projectId, spaceOwner: null, documentId, operation })}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1" },
      body: JSON.stringify(body),
    });
  const update = (id: string) => request("updates", { updateId: id, payload: "AQ==", blobIds: [] });
  const state = (stateId: string, baseStateId: string | null, through: number) =>
    request("state", { stateId, baseStateId, through, payload: "Ag==", summary: "Aw==", blobIds: [] });
  const readState = (stateId: string) =>
    fetch(
      `${peer.origin}${syncPath({
        kind: "state",
        projectId,
        spaceOwner: null,
        documentId,
        stateId,
      })}`,
      { headers: { authorization: `Bearer ${token}`, "pstdio-sync-protocol": "1" } },
    );
  return { documentId, request, update, state, readState };
};

test("pruned snapshot coverage requires the latest state and never reuses update sequence numbers", async () => {
  const peer = createPeer();
  const document = await documentRequests(peer);
  try {
    expect(await (await document.update("first_update_0123456789")).json()).toEqual({ sequence: 1, duplicate: false });
    expect((await document.state("first_state_0123456789", null, 1)).status).toBe(200);
    peer.trim(document.documentId);
    expect(await (await document.request("read", { after: 0 })).json()).toMatchObject({
      status: "state-required",
      lastSequence: 1,
      state: { through: 1 },
    });
    expect(await (await document.update("second_update_0123456789")).json()).toEqual({ sequence: 2, duplicate: false });
    expect(await (await document.request("read", { after: 1 })).json()).toMatchObject({
      status: "updates",
      lastSequence: 2,
      updates: [{ sequence: 2 }],
    });
    expect((await document.state("second_state_0123456789", "first_state_0123456789", 2)).status).toBe(200);
    peer.trim(document.documentId);
    expect(await (await document.update("third_update_0123456789")).json()).toEqual({ sequence: 3, duplicate: false });
  } finally {
    await stopPeer(peer);
  }
});

test("latest state replacement rejects a stale base and preserves an accepted retry", async () => {
  const peer = createPeer();
  const document = await documentRequests(peer);
  try {
    await document.update("first_update_0123456789");
    expect((await document.state("winner_state_0123456789", null, 1)).status).toBe(200);
    expect((await document.state("winner_state_0123456789", null, 1)).status).toBe(200);
    const rejected = await document.state("stale_state_0123456789", null, 1);
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({
      error: "stale-state",
      state: { stateId: "winner_state_0123456789" },
    });
    expect(peer.states()).toBe(1);
    expect((await document.state("future_state_0123456789", "winner_state_0123456789", 2)).status).toBe(400);
  } finally {
    await stopPeer(peer);
  }
});

test("one blocked device cannot read or write while two other enrolled devices keep syncing", async () => {
  const peer = createPeer();
  const [first, second, third] = await Promise.all(
    ["first", "second", "third"].map((id) => documentRequests(peer, id)),
  );
  try {
    peer.blockDevice("third", true);
    expect((await third.request("read", { after: 0 })).status).toBe(503);
    expect((await third.update("blocked_update_0123456789")).status).toBe(503);
    expect((await first.update("first_update_0123456789")).status).toBe(200);
    expect(await (await second.request("read", { after: 0 })).json()).toMatchObject({
      updates: [{ deviceId: "first" }],
    });
    peer.blockDevice("third", false);
    expect(await (await third.request("read", { after: 0 })).json()).toMatchObject({
      updates: [{ deviceId: "first" }],
    });
  } finally {
    await stopPeer(peer);
  }
});

test("snapshot fault injection preserves authenticated ciphertext and drops the covered tail explicitly", async () => {
  const { createSyncSpace, openState, sealState } = await import("pstdio-sync/encryption");
  const { packagedProjectKey } = await import("./packaged-sync-project-key.fixture");
  const peer = createPeer();
  const document = await documentRequests(peer);
  const space = await createSyncSpace({ projectId: "fixture-project", spaceOwner: null, keys: [packagedProjectKey] });
  try {
    const original = new TextEncoder().encode("earlier encrypted state");
    const first = await sealState(space, document.documentId, {
      baseStateId: null,
      through: 0,
      state: original,
      summary: new Uint8Array([1]),
      blobIds: [],
    });
    expect((await document.request("state", first)).status).toBe(200);
    const captured = peer.captureSnapshot(document.documentId);
    await document.update("later_update_0123456789");
    const current = await sealState(space, document.documentId, {
      baseStateId: first.stateId,
      through: 1,
      state: new Uint8Array([2]),
      summary: new Uint8Array([2]),
      blobIds: [],
    });
    expect((await document.request("state", current)).status).toBe(200);
    expect(captured.state.stateId).toBe(first.stateId);
    expect(captured.blobIds).toEqual(first.blobIds);
    const missingEdit = await sealState(space, document.documentId, {
      baseStateId: current.stateId,
      through: 1,
      state: await openState(space, document.documentId, captured.state, Buffer.from(captured.payload, "base64")),
      summary: new Uint8Array([1]),
      blobIds: [],
    });
    peer.installSnapshot(document.documentId, missingEdit);
    const installed = peer.captureSnapshot(document.documentId);
    expect(installed.state.stateId).not.toBe(first.stateId);
    expect(
      await openState(space, document.documentId, installed.state, Buffer.from(installed.payload, "base64")),
    ).toEqual(original);
    expect(await (await document.request("read", { after: 0 })).json()).toMatchObject({
      status: "state-required",
      state: { stateId: missingEdit.stateId, through: 1 },
      lastSequence: 1,
    });
  } finally {
    await stopPeer(peer);
  }
});

test("accepted and injected latest-state bytes remain immutable when a replacement races their read", async () => {
  const peer = createPeer();
  const document = await documentRequests(peer);
  try {
    const first = {
      stateId: "older_state_0123456789",
      baseStateId: null,
      through: 0,
      payload: "AQ==",
      summary: "AQ==",
      blobIds: [],
    };
    expect((await document.request("state", first)).status).toBe(200);
    const second = { ...first, stateId: "newer_state_0123456789", baseStateId: first.stateId, payload: "Ag==" };
    expect((await document.request("state", second)).status).toBe(200);
    const oldRead = await document.readState(first.stateId);
    expect(oldRead.status).toBe(200);
    expect(new Uint8Array(await oldRead.arrayBuffer())).toEqual(new Uint8Array([1]));
    const injected = { ...second, stateId: "fault_state_0123456789", baseStateId: second.stateId, payload: "Aw==" };
    peer.installSnapshot(document.documentId, injected);
    expect(new Uint8Array(await (await document.readState(second.stateId)).arrayBuffer())).toEqual(new Uint8Array([2]));
    expect(new Uint8Array(await (await document.readState(injected.stateId)).arrayBuffer())).toEqual(
      new Uint8Array([3]),
    );
    expect((await document.readState("unknown_state_0123456789")).status).toBe(404);
    expect(peer.retainedStates().map((state) => state.payload)).toEqual([
      first.payload,
      second.payload,
      injected.payload,
    ]);
  } finally {
    await stopPeer(peer);
  }
});
