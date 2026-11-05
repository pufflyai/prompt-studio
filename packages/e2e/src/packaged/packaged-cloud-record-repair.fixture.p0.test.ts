import { expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, createProjectsDBService } from "pstdio-db";
import { createSyncSpace, openState, openSummary, sealBlob, sealState } from "pstdio-sync/encryption";
import { createDocumentRelay, createRecordStreamSync, encodeRecordFrame, type SyncFailure } from "pstdio-sync/relay";
import { createPackagedSyncPeer, packagedProjectKey } from "./packaged-sync-relay.fixture";

// This is the production record-stream adapter, distinct from the Yjs text-document sync tests.
const scenario = async (run: (fixture: Awaited<ReturnType<typeof recordFixture>>) => Promise<void>) => {
  const f = await recordFixture();
  const failures: unknown[] = [];
  try {
    await run(f);
  } catch (error) {
    failures.push(error);
  }
  const results = await Promise.allSettled([f.close()]);
  failures.push(...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])));
  if (failures.length) throw new AggregateError(failures, "Record-stream acceptance or cleanup failed");
};

const recordFixture = async () => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.acceptance" };
  const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [packagedProjectKey] });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const peer = createPackagedSyncPeer(undefined);
  const closeDevices: (() => Promise<unknown>)[] = [];
  const device = async (deviceId: string) => {
    const enrolled = await fetch(`${peer.origin}/v1/device-login`, {
      method: "POST",
      body: JSON.stringify({ deviceId, name: deviceId }),
    });
    expect(enrolled.ok).toBe(true);
    const credential = (await enrolled.json()) as { token: string };
    const access = await fetch(`${peer.origin}/v1/environment-access`, {
      method: "POST",
      headers: { authorization: `Bearer ${credential.token}` },
      body: JSON.stringify({ workbenchId: projectId }),
    });
    expect(access.ok).toBe(true);
    const token = ((await access.json()) as { token: string }).token;
    const abort = new AbortController();
    const { db, close } = await createDb({ path: ":memory:" });
    closeDevices.push(async () => {
      abort.abort();
      await close();
    });
    await createProjectsDBService(db).create({ id: projectId, name: "Record repair acceptance" });
    const service = createExtensionStorageDBService(db);
    const records = (await service.open({ owner })).records;
    const store = service.documents.recordStream(owner);
    const relay = createDocumentRelay({
      origin: peer.origin,
      space,
      documentId,
      token: async () => token,
      signal: abort.signal,
    });
    const rejected: SyncFailure[] = [];
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay,
      store,
      quarantine: async (failure) => {
        rejected.push(failure);
      },
    });
    const snapshot = async () => {
      const saved = await store.snapshot();
      const chunk = await sealBlob(
        space,
        encodeRecordFrame({ records: saved.records, assets: [], format: store.recordFormat }),
      );
      await relay.blobs.put(chunk.blobId, chunk.bytes);
      const remote = await relay.read(0);
      const state = await sealState(space, documentId, {
        baseStateId: remote.state?.stateId ?? null,
        through: remote.lastSequence,
        state: new TextEncoder().encode(
          JSON.stringify({
            version: 1,
            format: store.recordFormat,
            chunks: [{ blobId: chunk.blobId, byteLength: chunk.bytes.length }],
          }),
        ),
        summary: new TextEncoder().encode(
          JSON.stringify({
            records: saved.records.length,
            bytes: chunk.bytes.length,
            format: store.recordFormat,
            receiptRoot: saved.receiptRoot ?? null,
          }),
        ),
        blobIds: [chunk.blobId, ...(saved.blobIds ?? [])],
      });
      expect(await relay.replace(state)).toBe(true);
      return state;
    };
    return { records, store, relay, sync, rejected, snapshot };
  };
  return {
    device,
    peer,
    space,
    documentId,
    async close() {
      const results = await Promise.allSettled([...closeDevices.map((close) => close()), peer.stop()]);
      const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (failures.length) throw new AggregateError(failures, "Record-stream fixture cleanup failed");
    },
  };
};

test("a quiet record-stream holder repairs a valid same-through incomplete manifest before a reset device joins", async () =>
  scenario(async (f) => {
    const [startingFirst, startingSecond] = await Promise.allSettled([
      f.device("record-first"),
      f.device("record-second"),
    ]);
    if (startingFirst.status === "rejected" || startingSecond.status === "rejected")
      throw new AggregateError(
        [startingFirst, startingSecond].flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
        "Could not start record devices",
      );
    const first = startingFirst.value;
    const second = startingSecond.value;
    await first.records.commit({
      operationId: "seed",
      edits: [{ recordId: "note", replace: { title: "kept note" } }],
    });
    await first.sync.synchronize();
    await second.sync.synchronize();
    const earlier = f.peer.captureSnapshot(f.documentId);
    expect(earlier.blobIds.length).toBeGreaterThan(0);
    await first.records.commit({
      operationId: "later",
      edits: [{ recordId: "later", replace: { title: "retained quiet edit" } }],
    });
    await first.sync.synchronize();
    await second.sync.synchronize();
    expect(await second.records.read("later")).toMatchObject({ exists: true, value: { title: "retained quiet edit" } });
    const current = await first.snapshot();
    await first.sync.synchronize();
    await second.sync.synchronize();
    expect((await first.store.open()).after).toBe(current.through);
    const missing = await sealState(f.space, f.documentId, {
      baseStateId: current.stateId,
      through: current.through,
      state: await openState(f.space, f.documentId, earlier.state, Buffer.from(earlier.payload, "base64")),
      summary: await openSummary(f.space, f.documentId, earlier.state),
      blobIds: earlier.blobIds,
    });
    f.peer.installSnapshot(f.documentId, missing);
    // Both joined holders are quiet. Loading metadata must not acknowledge missing saved records.
    await first.sync.synchronize();
    await second.sync.synchronize();
    expect(await first.records.read("later")).toMatchObject({ exists: true, value: { title: "retained quiet edit" } });
    const third = await f.device("record-third-reset");
    await third.sync.synchronize();
    const diagnostics = {
      holder: await first.sync.status(),
      reset: await third.sync.status(),
      cursor: await first.store.open(),
      relay: await first.relay.read(0),
      rejected: first.rejected,
    };
    expect(await third.records.read("later"), JSON.stringify(diagnostics)).toMatchObject({
      exists: true,
      value: { title: "retained quiet edit" },
    });
  }));
