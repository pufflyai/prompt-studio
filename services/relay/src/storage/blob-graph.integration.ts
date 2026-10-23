import { afterAll, beforeAll, expect, test } from "bun:test";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());
const day = 86_400_000;
const later = (days: number) => new Date(Date.now() + days * day);

test("retained manifest trees protect descendants without adding grace per level", async () => {
  const { sync } = fixture.open({ gracePeriodMs: day });
  const address = { projectKey: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const upload = async (children: string[] = []) => {
    const blob = { ...address, blobId: randomId("blob") };
    const bytes = new Uint8Array([1, 2, 3]);
    const input = { sha256: sha256(bytes), byteLength: bytes.length };
    await sync.blobs.beginManifest(blob, caller, { ...input, children });
    await sync.blobs.writePart(blob, 1, { ...input, body: body(bytes) });
    await sync.blobs.finish(blob);
    return blob;
  };
  const leaf = await upload();
  const branch = await upload([leaf.blobId]);
  const root = await upload([branch.blobId]);
  await sync.documents.appendUpdate(address, caller, {
    updateId: randomId("update"),
    payload: encode(new Uint8Array([1])),
    blobIds: [root.blobId],
  });
  await sync.cleanup(later(2));
  expect((await sync.blobs.read(leaf, 0)).byteLength).toBe(3);
  const first = await sync.documents.replaceState(address, caller, {
    stateId: randomId("state"),
    baseStateId: null,
    through: 1,
    payload: encode(new Uint8Array([1])),
    summary: encode(new Uint8Array([1])),
    blobIds: [],
  });
  expect(first.state.through).toBe(1);
  await sync.cleanup(later(2));
  for (const blob of [root, branch, leaf]) expect((await sync.blobs.read(blob, 0)).byteLength).toBe(3);
  await sync.cleanup(later(4));
  for (const blob of [root, branch, leaf]) {
    const error = await sync.blobs.read(blob, 0).catch((error: unknown) => error);
    expect(error).toMatchObject({ status: 404 });
  }
});

test("an open staged parent protects older completed children and expires with its original grace", async () => {
  const { Client } = await import("pg");
  const { sync } = fixture.open({ gracePeriodMs: day });
  const owner = { projectKey: randomId("project"), spaceOwner: null };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const leaf = { ...owner, blobId: randomId("leaf") };
  const parent = { ...owner, blobId: randomId("parent") };
  const bytes = new Uint8Array([3]);
  const input = { sha256: sha256(bytes), byteLength: bytes.length };
  await sync.blobs.begin(leaf, caller, input);
  await sync.blobs.writePart(leaf, 1, { ...input, body: body(bytes) });
  await sync.blobs.finish(leaf);
  // Age only the disposable fixture's upload metadata; no sleeps or grace changes.
  const pg = new Client({ connectionString: fixture.databaseUrl });
  await pg.connect();
  try {
    await pg.query('UPDATE relay_sync_blobs SET "completedAt" = $1 WHERE "projectKey" = $2 AND "blobId" = $3', [
      later(-2),
      owner.projectKey,
      leaf.blobId,
    ]);
  } finally {
    await pg.end();
  }
  await sync.blobs.beginManifest(parent, caller, { ...input, children: [leaf.blobId] });
  await sync.cleanup();
  expect((await sync.blobs.read(leaf, 0)).byteLength).toBe(1);
  await sync.cleanup(later(2));
  expect(await sync.blobs.read(leaf, 0).catch((error: unknown) => error)).toMatchObject({ status: 404 });
  expect(
    await sync.blobs
      .beginManifest(parent, caller, { ...input, children: [leaf.blobId] })
      .catch((error: unknown) => error),
  ).toMatchObject({ status: 409 });
});

test("immutable manifest children must already exist in the same project and space", async () => {
  const { sync } = fixture.open();
  const owner = { projectKey: randomId("project"), spaceOwner: null };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const bytes = new Uint8Array([5]);
  const input = { sha256: sha256(bytes), byteLength: bytes.length };
  const child = { ...owner, blobId: randomId("child") };
  const parent = { ...owner, blobId: randomId("parent") };
  const graph = { ...input, children: [child.blobId] };
  const rejected = async (action: Promise<unknown>, status: number) =>
    expect(await action.catch((error: unknown) => error)).toMatchObject({ status });
  await rejected(sync.blobs.beginManifest(parent, caller, graph), 409);
  await sync.blobs.begin(child, caller, input);
  await rejected(sync.blobs.beginManifest(parent, caller, graph), 409);
  await sync.blobs.writePart(child, 1, { ...input, body: body(bytes) });
  await sync.blobs.finish(child);
  await rejected(sync.blobs.beginManifest({ ...parent, spaceOwner: caller.accountId }, caller, graph), 409);
  await rejected(sync.blobs.beginManifest({ ...parent, projectKey: randomId("other") }, caller, graph), 409);
  await rejected(sync.blobs.beginManifest(parent, caller, { ...input, children: [parent.blobId] }), 400);
  await rejected(sync.blobs.beginManifest(parent, caller, { ...input, children: [child.blobId, child.blobId] }), 400);
  await rejected(
    sync.blobs.beginManifest(parent, caller, {
      ...input,
      children: Array.from({ length: 257 }, () => randomId("child")),
    }),
    400,
  );
  await sync.blobs.beginManifest(parent, caller, graph);
  expect((await sync.blobs.beginManifest(parent, caller, graph)).completed).toBe(false);
  await rejected(sync.blobs.beginManifest(parent, caller, { ...input, children: [] }), 400);
  await rejected(sync.blobs.begin(parent, caller, input), 400);
  await sync.blobs.writePart(parent, 1, { ...input, body: body(bytes) });
  await sync.blobs.finish(parent);
  expect((await sync.blobs.beginManifest(parent, caller, graph)).completed).toBe(true);
});

test("a shared descendant remains live until the last retained manifest retires", async () => {
  const { sync } = fixture.open({ gracePeriodMs: day });
  const address = { projectKey: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const upload = async (children: string[] = []) => {
    const blob = { ...address, blobId: randomId("blob") };
    const bytes = new Uint8Array([6]);
    const input = { sha256: sha256(bytes), byteLength: bytes.length };
    await sync.blobs.beginManifest(blob, caller, { ...input, children });
    await sync.blobs.writePart(blob, 1, { ...input, body: body(bytes) });
    await sync.blobs.finish(blob);
    return blob;
  };
  const child = await upload();
  const first = await upload([child.blobId]);
  const second = await upload([child.blobId]);
  await sync.documents.appendUpdate(address, caller, {
    updateId: randomId("update"),
    payload: encode(new Uint8Array([1])),
    blobIds: [first.blobId, second.blobId],
  });
  const state = await sync.documents.replaceState(address, caller, {
    stateId: randomId("state"),
    baseStateId: null,
    through: 1,
    payload: encode(new Uint8Array([1])),
    summary: encode(new Uint8Array([1])),
    blobIds: [second.blobId],
  });
  await sync.cleanup(later(2));
  await sync.cleanup(later(4));
  expect(await sync.blobs.read(first, 0).catch((error: unknown) => error)).toMatchObject({ status: 404 });
  for (const blob of [child, second]) expect((await sync.blobs.read(blob, 0)).byteLength).toBe(1);
  await sync.documents.replaceState(address, caller, {
    stateId: randomId("state"),
    baseStateId: state.state.stateId,
    through: 1,
    payload: encode(new Uint8Array([1])),
    summary: encode(new Uint8Array([1])),
    blobIds: [],
  });
  await sync.cleanup(later(5));
  expect((await sync.blobs.read(child, 0)).byteLength).toBe(1);
  await sync.cleanup(later(7));
  for (const blob of [child, second])
    expect(await sync.blobs.read(blob, 0).catch((error: unknown) => error)).toMatchObject({ status: 404 });
});
