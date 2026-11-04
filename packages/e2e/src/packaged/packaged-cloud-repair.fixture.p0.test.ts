import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createSyncSpace, openState, openSummary, sealState } from "pstdio-sync/encryption";
import { createDocumentRelay, createDocumentSync, type SyncFailure } from "pstdio-sync/relay";
import * as Y from "yjs";
import { createPackagedSyncPeer, packagedProjectKey } from "./packaged-sync-relay.fixture";

// Native shared text uses createDocumentSync. Extension records use createRecordStreamSync,
// whose manifest repair acceptance is exercised separately. These tests cover only document transport.
const owner = { workbenchId: "cloud-repair-project", extensionId: "example.acceptance" };
const space = await createSyncSpace({ projectId: owner.workbenchId, spaceOwner: null, keys: [packagedProjectKey] });
const documentId = await space.documentId(JSON.stringify([owner.extensionId, "fixture-document"]));

const enrolledToken = async (origin: string, deviceId: string) => {
  const enrolled = await fetch(`${origin}/v1/device-login`, {
    method: "POST",
    body: JSON.stringify({ deviceId, name: deviceId }),
  });
  expect(enrolled.ok).toBe(true);
  const { token } = (await enrolled.json()) as { token: string };
  const response = await fetch(`${origin}/v1/environment-access`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ workbenchId: owner.workbenchId }),
  });
  expect(response.ok).toBe(true);
  return ((await response.json()) as { token: string }).token;
};

const fixture = () => {
  const peer = createPackagedSyncPeer(undefined);
  const closeDevices: (() => Promise<void>)[] = [];
  const device = async (deviceId: string) => {
    const token = await enrolledToken(peer.origin, deviceId);
    const store = createMemoryDocumentStore();
    const abort = new AbortController();
    const relay = createDocumentRelay({
      origin: peer.origin,
      space,
      documentId,
      token: async () => token,
      signal: abort.signal,
    });
    const rejected: SyncFailure[] = [];
    const sync = createDocumentSync({
      owner,
      store,
      space,
      documentId,
      relay,
      quarantine: async (failure) => {
        rejected.push(failure);
      },
    });
    closeDevices.push(async () => {
      sync.close();
      abort.abort();
      await store.transaction(owner, async ({ document }) => {
        document.destroy();
      });
    });
    const set = (key: string, value: unknown) =>
      store.transaction(owner, async ({ document }) => {
        document.getMap("content").set(key, value);
      });
    const values = () => store.transaction(owner, async ({ document }) => document.getMap("content").toJSON());
    // Publish through the real HTTP adapter without changing production compaction thresholds.
    const snapshot = async () => {
      const remote = await relay.read(0);
      const state = await store.transaction(owner, async ({ document }) =>
        sealState(space, documentId, {
          baseStateId: remote.state?.stateId ?? null,
          through: remote.lastSequence,
          state: Y.encodeStateAsUpdate(document),
          summary: Y.encodeStateVector(document),
          blobIds: [],
        }),
      );
      expect(await relay.replace(state)).toBe(true);
      return state;
    };
    return { deviceId, relay, sync, store, rejected, set, values, snapshot };
  };
  return {
    peer,
    device,
    async close() {
      const results = await Promise.allSettled([...closeDevices.map((close) => close()), peer.stop()]);
      const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (failures.length) throw new AggregateError(failures, "Could not close adapter fixture");
    },
  };
};

const withFixture = async (run: (value: ReturnType<typeof fixture>) => Promise<void>) => {
  const f = fixture();
  const failures: unknown[] = [];
  try {
    await run(f);
  } catch (error) {
    failures.push(error);
  }
  const cleanup = await Promise.allSettled([f.close()]);
  failures.push(...cleanup.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])));
  if (failures.length) throw new AggregateError(failures, "Adapter scenario or cleanup failed");
};

const expectOpaque = (peer: ReturnType<typeof createPackagedSyncPeer>, canaries: string[]) => {
  const bytes = [...peer.documents.values()].flatMap((document) => [
    Buffer.from(JSON.stringify(document)),
    ...[document.payload, document.state?.summary, ...document.updates.map((update) => update.payload)]
      .filter((payload): payload is string => typeof payload === "string")
      .map((payload) => Buffer.from(payload, "base64")),
  ]);
  bytes.push(
    ...peer.blobContents(),
    ...peer
      .retainedStates()
      .flatMap((state) => [Buffer.from(JSON.stringify(state)), Buffer.from(state.payload, "base64")]),
  );
  for (const dump of bytes) for (const canary of canaries) expect(dump.toString("latin1")).not.toContain(canary);
};

test("three document-sync clients retain an offline edit across eight pruned latest-state replacements", async () =>
  withFixture(async (f) => {
    const starting = await Promise.allSettled(["device-first", "device-second", "device-third"].map(f.device));
    const failures = starting.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    if (failures.length) throw new AggregateError(failures, "Could not enroll all three document clients");
    const [first, second, third] = starting.map(
      (result) => (result as PromiseFulfilledResult<Awaited<ReturnType<typeof f.device>>>).value,
    ) as [
      Awaited<ReturnType<typeof f.device>>,
      Awaited<ReturnType<typeof f.device>>,
      Awaited<ReturnType<typeof f.device>>,
    ];
    expect(new Set([first!.deviceId, second!.deviceId, third!.deviceId]).size).toBe(3);
    await first.set("title", "relay-title-canary");
    await first.sync.synchronize();
    await first.snapshot();
    await second.sync.synchronize();
    await third.sync.synchronize();
    f.peer.blockDevice(third.deviceId, true);
    await third.set("offline", "offline-edit-canary");
    await expect(third.sync.synchronize()).rejects.toThrow("503");
    const states = new Set<string>();
    for (let index = 0; index < 8; index++) {
      await first.set(`edit-${index}`, `online-edit-canary-${index}`);
      await first.sync.synchronize();
      const state = await first.snapshot();
      states.add(state.stateId);
      f.peer.trim(documentId);
      await second.sync.synchronize();
      expect(await second.values()).toEqual(await first.values());
    }
    expect(states.size).toBe(8);
    expect(f.peer.documents.get(`~${documentId}`)!.updates).toEqual([]);
    f.peer.blockDevice(third.deviceId, false);
    expect((await third.relay.read(0)).status).toBe("state-required");
    await third.sync.synchronize();
    await first.sync.synchronize();
    await second.sync.synchronize();
    const expected = await third.values();
    expect(expected).toMatchObject({
      title: "relay-title-canary",
      offline: "offline-edit-canary",
      "edit-7": "online-edit-canary-7",
    });
    expect(await first.values()).toEqual(expected);
    expect(await second.values()).toEqual(expected);
    for (const device of [first, second, third]) expect(device.rejected).toEqual([]);
    expectOpaque(f.peer, ["relay-title-canary", "offline-edit-canary", "online-edit-canary"]);
  }));

test("a quiet document-sync client repairs a valid incomplete latest state and an empty third client recovers the repaired content", async () =>
  withFixture(async (f) => {
    const [first, second] = await Promise.all(["device-first", "device-second"].map(f.device));
    await first.set("note", "retained-note-canary");
    await first.sync.synchronize();
    await first.snapshot();
    await second.sync.synchronize();
    const earlier = f.peer.captureSnapshot(documentId);
    await first.set("file", { name: "private-filename-canary.md", bytes: "private-file-bytes-canary" });
    await first.sync.synchronize();
    const current = await first.snapshot();
    const expected = await first.values();
    const missing = await sealState(space, documentId, {
      baseStateId: current.stateId,
      through: current.through,
      state: await openState(space, documentId, earlier.state, Buffer.from(earlier.payload, "base64")),
      summary: await openSummary(space, documentId, earlier.state),
      blobIds: [],
    });
    f.peer.installSnapshot(documentId, missing);
    const beforeRepair = f.peer.documents.get(`~${documentId}`)!.updates.length;
    // No save on first: synchronization alone notices missing edits in the latest state's summary.
    await first.sync.synchronize();
    expect(f.peer.documents.get(`~${documentId}`)!.updates.length).toBeGreaterThan(beforeRepair);
    const third = await f.device("device-third-reset");
    expect(await third.values()).toEqual({});
    await third.sync.synchronize();
    await second.sync.synchronize();
    expect(await third.values()).toEqual(expected);
    expect(await second.values()).toEqual(expected);
    expect(await first.values()).toEqual(expected);
    for (const device of [first, second, third]) expect(device.rejected).toEqual([]);
    expectOpaque(f.peer, ["retained-note-canary", "private-filename-canary.md", "private-file-bytes-canary"]);
  }));
