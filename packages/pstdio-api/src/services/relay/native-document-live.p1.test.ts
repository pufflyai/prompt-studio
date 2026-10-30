import { expect, spyOn, test } from "bun:test";
import { createSyncSpace, openLive, sealLive } from "pstdio-sync/encryption";
import type { LiveClientMessage, SpaceKey } from "pstdio-sync-contracts";
import { createNativeSessionPresence } from "../native-documents/session-presence";
import { createNativeDocumentLive } from "./native-document-live";

const projectId = "project";
const key = (generation: number): SpaceKey => ({
  generation,
  secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
});
const source = () => {
  const manager = createNativeSessionPresence({
    deviceId: "sender",
    identity: async () => ({ label: "Alice private", deviceName: "Laptop" }),
  });
  const publishing: Promise<unknown>[] = [];
  const live = {
    ...manager.live,
    subscribe: (projectId: string, publish: Parameters<typeof manager.live.subscribe>[1]) =>
      manager.live.subscribe(projectId, (frame) => {
        const result = Promise.resolve(publish(frame));
        publishing.push(result);
        return result;
      }),
  };
  return { manager, live, publishing };
};
const join = (manager: ReturnType<typeof createNativeSessionPresence>) =>
  manager.join(
    {
      owner: { workbenchId: projectId, extensionId: "example.notes" },
      documentKey: "a".repeat(64),
    },
    { roomId: crypto.randomUUID(), seedId: "b".repeat(64) },
  );

test("credential renewal retains remote presence until a real disconnect", async () => {
  const manager = createNativeSessionPresence({
    deviceId: "receiver",
    identity: async () => ({ label: "Receiver", deviceName: "Desktop" }),
  });
  const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [key(1)] });
  const bridge = createNativeDocumentLive({ projectId, deviceId: "receiver", live: manager.live, send: () => true });
  const local = await join(manager);
  try {
    bridge.setSpace(space);
    const encrypted = await sealLive(
      space,
      "peer",
      new TextEncoder().encode(
        JSON.stringify({
          kind: "native-document-presence",
          version: 1,
          action: "upsert",
          extensionId: "example.notes",
          documentKey: "a".repeat(64),
          participantId: crypto.randomUUID(),
          seedId: "b".repeat(64),
          label: "Peer",
          deviceName: "Laptop",
          selection: null,
        }),
      ),
    );
    await bridge.receive({ ...encrypted, deviceId: "peer" });
    expect(local.snapshot()).toHaveLength(2);
    bridge.renewAccess();
    expect(local.snapshot()).toHaveLength(2);
    // Credential rotation does not wait for the durable synchronizer to fetch the space again.
    expect(await bridge.receive({ ...encrypted, deviceId: "peer" })).toBe(true);
    bridge.setSpace(space);
    expect(local.snapshot()).toHaveLength(2);
    bridge.clearSpace();
    expect(local.snapshot()).toHaveLength(1);
  } finally {
    local.close();
    await bridge.close();
    manager.close();
  }
});

test("live encryption preserves publish order so a delayed update cannot arrive after its leave", async () => {
  const s = source();
  const sent: LiveClientMessage[] = [];
  const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [key(1)] });
  const bridge = createNativeDocumentLive({
    projectId,
    deviceId: "sender",
    live: s.live,
    send: (frame) => {
      sent.push(frame);
      return true;
    },
  });
  bridge.setSpace(space);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  let calls = 0;
  const paused = spyOn(crypto.subtle, "encrypt").mockImplementation(async (...args) => {
    calls++;
    if (calls === 1) {
      entered.resolve();
      await release.promise;
    }
    return encrypt(...args);
  });
  try {
    const connection = await join(s.manager);
    await entered.promise;
    // Publish a second connection and a leave while the first real AES operation is paused.
    const second = await join(s.manager);
    second.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toBe(1);
    release.resolve();
    await Promise.all(s.publishing);
    const actions = await Promise.all(
      sent.map(
        async (frame) =>
          JSON.parse(new TextDecoder().decode(await openLive(space, { ...frame, deviceId: "sender" }))).action,
      ),
    );
    expect(actions).toEqual(["upsert", "upsert", "leave"]);
    connection.close();
  } finally {
    release.resolve();
    paused.mockRestore();
    await Promise.allSettled(s.publishing);
    await bridge.close();
    s.manager.close();
  }
});

test("live presence stays encrypted, binds the sender, and uses new keys after rotation", async () => {
  const s = source();
  const sent: LiveClientMessage[] = [];
  const firstKey = key(1);
  const old = await createSyncSpace({ projectId, spaceOwner: null, keys: [firstKey] });
  const next = await createSyncSpace({ projectId, spaceOwner: null, keys: [firstKey, key(2)] });
  const bridge = createNativeDocumentLive({
    projectId,
    deviceId: "sender",
    live: s.live,
    send: (frame) => {
      sent.push(frame);
      return true;
    },
  });
  try {
    const connection = await join(s.manager);
    await Promise.all(s.publishing);
    expect(sent).toEqual([]);
    bridge.setSpace(old);
    await Promise.all(s.publishing);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent)).not.toContain("Alice private");
    expect(JSON.parse(new TextDecoder().decode(await openLive(old, { ...sent[0]!, deviceId: "sender" }))).label).toBe(
      "Alice private",
    );
    expect(await bridge.receive({ ...sent[0]!, deviceId: "another-device" })).toBe(false);
    bridge.clearSpace();
    bridge.setSpace(next);
    await Promise.all(s.publishing);
    const rotated = sent.at(-1)!;
    await expect(openLive(old, { ...rotated, deviceId: "sender" })).rejects.toThrow();
    expect(JSON.parse(new TextDecoder().decode(await openLive(next, { ...rotated, deviceId: "sender" }))).label).toBe(
      "Alice private",
    );
    connection.close();
  } finally {
    await bridge.close();
    s.manager.close();
  }
});

test("reconnecting drops live frames admitted by the previous connection before their decryption ran", async () => {
  const manager = createNativeSessionPresence({
    deviceId: "receiver",
    identity: async () => ({ label: "Receiver", deviceName: "Desktop" }),
  });
  const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [key(1)] });
  const bridge = createNativeDocumentLive({ projectId, deviceId: "receiver", live: manager.live, send: () => true });
  await join(manager);
  bridge.setSpace(space);
  const encrypted = await sealLive(
    space,
    "peer-device",
    new TextEncoder().encode(
      JSON.stringify({
        kind: "native-document-presence",
        version: 1,
        action: "upsert",
        extensionId: "example.notes",
        documentKey: "a".repeat(64),
        participantId: crypto.randomUUID(),
        seedId: "b".repeat(64),
        label: "Peer",
        deviceName: "Laptop",
        selection: null,
      }),
    ),
  );
  const frame = { ...encrypted, deviceId: "peer-device" };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
  let calls = 0;
  const paused = spyOn(crypto.subtle, "decrypt").mockImplementation(async (...args) => {
    if (++calls === 1) {
      entered.resolve();
      await release.promise;
    }
    return decrypt(...args);
  });
  try {
    const first = bridge.receive(frame);
    await entered.promise;
    const queued = bridge.receive(frame);
    bridge.clearSpace();
    bridge.setSpace(space);
    release.resolve();
    expect(await Promise.all([first, queued])).toEqual([false, false]);
  } finally {
    release.resolve();
    paused.mockRestore();
    await bridge.close();
    manager.close();
  }
});
