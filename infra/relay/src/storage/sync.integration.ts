import { afterAll, beforeAll, expect, test } from "bun:test";
import { SyncRejection } from "./accounts";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const day = 24 * 60 * 60 * 1000;
const later = (ms: number) => new Date(Date.now() + ms);
const document = (spaceOwner: string | null = null) => ({
  projectKey: randomId("project"),
  spaceOwner,
  documentId: randomId("doc"),
});
const caller = (accountId = randomId("account")) => ({ accountId, deviceId: randomId("device") });
const update = (bytes = new Uint8Array([1, 2, 3]), blobIds: string[] = []) => ({
  updateId: randomId("update"),
  payload: encode(bytes),
  blobIds,
});
const state = (baseStateId: string | null, through: number, bytes = new Uint8Array(64), blobIds: string[] = []) => ({
  stateId: randomId("state"),
  baseStateId,
  through,
  payload: encode(bytes),
  summary: encode(new Uint8Array([through])),
  blobIds,
});
const bytesOf = async (body: ReadableStream<Uint8Array> | undefined) =>
  new Uint8Array(await new Response(body).arrayBuffer());
const rejected = async (action: Promise<unknown>) => {
  const error = await action.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(SyncRejection);
  return error as SyncRejection;
};

test("an update ID the relay already stored is ignored", async () => {
  const { sync } = fixture.open();
  const address = document();
  const device = caller();
  const first = update();
  expect(await sync.documents.appendUpdate(address, device, first)).toEqual({ sequence: 1, duplicate: false });
  const concurrent = await Promise.all([
    sync.documents.appendUpdate(address, device, { ...first, payload: encode(new Uint8Array([9])) }),
    sync.documents.appendUpdate(address, device, first),
  ]);
  expect(concurrent).toEqual([
    { sequence: 1, duplicate: true },
    { sequence: 1, duplicate: true },
  ]);
  const read = await sync.documents.read(address, 0);
  expect(read.status === "updates" && read.updates.map((entry) => entry.payload)).toEqual([first.payload]);
  // Bytes of the ignored copies are queued and removed; the stored update keeps its bytes.
  await sync.cleanup();
  expect(await sync.documents.read(address, 0)).toMatchObject({
    status: "updates",
    updates: [{ payload: first.payload }],
  });
});

test("a latest state built on a replaced state is rejected", async () => {
  const { sync } = fixture.open();
  const address = document();
  const device = caller();
  await sync.documents.appendUpdate(address, device, update());
  await sync.documents.appendUpdate(address, device, update());
  const base = (await sync.documents.replaceState(address, device, state(null, 1))).state;
  const winner = state(base.stateId, 2);
  const loser = state(base.stateId, 2);
  await sync.documents.replaceState(address, device, winner);
  const stale = await rejected(sync.documents.replaceState(address, device, loser));
  expect(stale.status).toBe(409);
  expect(stale.body).toMatchObject({ error: "stale-state", state: { stateId: winner.stateId, through: 2 } });
  // A retry of the accepted state after a lost response succeeds without a second copy.
  expect((await sync.documents.replaceState(address, device, winner)).state.stateId).toBe(winner.stateId);
  const read = await sync.documents.read(address, 2);
  expect(read).toMatchObject({ status: "updates", state: { stateId: winner.stateId }, lastSequence: 2, updates: [] });
});

test("only the replaced latest state and the updates after it stay for the grace period", async () => {
  const { sync } = fixture.open({ gracePeriodMs: day });
  const address = document();
  const device = caller();
  for (let index = 0; index < 2; index++) await sync.documents.appendUpdate(address, device, update());
  const first = (await sync.documents.replaceState(address, device, state(null, 1))).state;
  await sync.documents.appendUpdate(address, device, update());
  const second = (await sync.documents.replaceState(address, device, state(first.stateId, 3, new Uint8Array(32))))
    .state;
  await sync.documents.appendUpdate(address, device, update());
  const third = (await sync.documents.replaceState(address, device, state(second.stateId, 4))).state;
  expect(await sync.documents.readState(address, first.stateId)).toBeNull();
  expect(await bytesOf((await sync.documents.readState(address, second.stateId))?.body)).toEqual(new Uint8Array(32));
  // A device that has the replaced state can still catch up with updates.
  const tail = await sync.documents.read(address, 3);
  expect(tail.status === "updates" && tail.updates.map((entry) => entry.sequence)).toEqual([4]);
  // A device further behind downloads the latest state.
  expect(await sync.documents.read(address, 0)).toMatchObject({
    status: "state-required",
    state: { stateId: third.stateId },
  });
  await sync.cleanup(later(2 * day));
  expect(await sync.documents.readState(address, second.stateId)).toBeNull();
  expect(await sync.documents.read(address, 3)).toMatchObject({ status: "state-required" });
  expect(await sync.documents.read(address, 4)).toMatchObject({ status: "updates", updates: [] });
});

test("a blob stays for the grace period after its last use, then is removed", async () => {
  const { sync } = fixture.open({ gracePeriodMs: day });
  const address = document();
  const device = caller();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const blob = { projectKey: address.projectKey, spaceOwner: null, blobId: randomId("blob") };
  const missing = await rejected(sync.documents.appendUpdate(address, device, update(undefined, [blob.blobId])));
  expect(missing.body).toEqual({ error: "missing-blobs", blobIds: [blob.blobId] });
  await sync.blobs.begin(blob, device, { sha256: sha256(bytes), byteLength: bytes.length });
  await sync.blobs.writePart(blob, 1, { sha256: sha256(bytes), byteLength: bytes.length, body: body(bytes) });
  await sync.blobs.finish(blob);
  await sync.documents.appendUpdate(address, device, update(undefined, [blob.blobId]));
  // A new latest state no longer uses the blob, but the update it covers keeps it for the grace period.
  const first = (await sync.documents.replaceState(address, device, state(null, 1))).state;
  await sync.cleanup(later(day / 2));
  expect(await bytesOf((await sync.blobs.read(blob, 0)).body)).toEqual(bytes);
  // An offline device's edit that uses the blob within the grace period is accepted.
  await sync.documents.appendUpdate(address, device, update(undefined, [blob.blobId]));
  await sync.documents.replaceState(address, device, state(first.stateId, 2));
  await sync.cleanup(later(2 * day));
  // Its last update was removed just now, so the blob stays one more grace period.
  expect((await sync.blobs.read(blob, 0)).byteLength).toBe(32);
  await sync.cleanup(later(4 * day));
  expect((await rejected(sync.blobs.read(blob, 0))).status).toBe(404);
});

test("a personal-space document is invisible from the project space", async () => {
  const { sync } = fixture.open();
  const owner = caller();
  const personal = document(owner.accountId);
  await sync.documents.appendUpdate(personal, owner, update());
  const shared = { ...personal, spaceOwner: null };
  expect((await rejected(sync.documents.read(shared, 0))).status).toBe(404);
  expect((await rejected(sync.documents.appendUpdate(shared, owner, update()))).status).toBe(404);
});

test("size limits and the account quota are enforced from metadata", async () => {
  const { sync } = fixture.open({ maxUpdateBytes: 8, accountQuotaBytes: 12 });
  const address = document();
  const device = caller();
  expect((await rejected(sync.documents.appendUpdate(address, device, update(new Uint8Array(9))))).status).toBe(413);
  await sync.documents.appendUpdate(address, device, update(new Uint8Array(8)));
  expect((await rejected(sync.documents.appendUpdate(address, device, update(new Uint8Array(5))))).status).toBe(507);
});
