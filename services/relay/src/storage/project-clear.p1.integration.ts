import { afterAll, beforeAll, expect, test } from "bun:test";
import { runRelayProjectClear } from "../../scripts/project-clear";
import { projectKey, SyncRejection } from "./accounts";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("an operator clears one project's rows and objects, leaving other projects and accounts untouched", async () => {
  const { sync } = fixture.open();
  const account = randomId("account");
  const other = randomId("account");
  const device = { accountId: account, deviceId: randomId("device") };

  const write = async (caller: typeof device, project: string) => {
    const key = projectKey(caller.accountId, project);
    const shared = { projectKey: key, spaceOwner: null, documentId: randomId("doc") };
    const personal = { projectKey: key, spaceOwner: caller.accountId, documentId: randomId("doc") };
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const blob = { projectKey: key, spaceOwner: null, blobId: randomId("blob") };
    await sync.blobs.begin(blob, caller, { sha256: sha256(bytes), byteLength: bytes.length });
    await sync.blobs.writePart(blob, 1, { sha256: sha256(bytes), byteLength: bytes.length, body: body(bytes) });
    await sync.blobs.finish(blob);
    // An upload that never finished.
    const open = { projectKey: key, spaceOwner: null, blobId: randomId("blob") };
    await sync.blobs.begin(open, caller, { sha256: sha256(bytes), byteLength: bytes.length });
    await sync.blobs.writePart(open, 1, { sha256: sha256(bytes), byteLength: bytes.length, body: body(bytes) });
    const update = (blobIds: string[] = []) => ({
      updateId: randomId("update"),
      payload: encode(crypto.getRandomValues(new Uint8Array(16))),
      blobIds,
    });
    await sync.documents.appendUpdate(shared, caller, update([blob.blobId]));
    await sync.documents.appendUpdate(shared, caller, update());
    await sync.documents.replaceState(shared, caller, {
      stateId: randomId("state"),
      baseStateId: null,
      through: 1,
      payload: encode(new Uint8Array(64)),
      summary: encode(new Uint8Array([1])),
      blobIds: [blob.blobId],
    });
    await sync.documents.appendUpdate(personal, caller, update());
    return { shared, blob, bytes };
  };

  const kept = await write(device, "beta");
  const foreign = await write({ accountId: other, deviceId: randomId("device") }, "alpha");
  const keptObjects = [...(await fixture.objects()).keys()].sort();
  const cleared = await write(device, "alpha");
  const rowsWith = async (key: string) => (await fixture.rows()).filter((row) => row.includes(key));
  const alpha = projectKey(account, "alpha");
  const beforeRows = await rowsWith(alpha);

  const args = ["--account", account, "--project", "alpha"];
  const dryRun = await runRelayProjectClear(args, fixture.databaseUrl);
  expect(dryRun).toMatchObject({
    projectKey: alpha,
    executed: false,
    before: {
      project: true,
      documents: 2,
      updates: { count: 3 },
      states: { count: 1 },
      blobs: { count: 2, bytes: 96, deleting: 0 },
    },
  });
  expect(await rowsWith(alpha)).toEqual(beforeRows);
  await expect(runRelayProjectClear([...args, "--confirm", "beta"], fixture.databaseUrl)).rejects.toThrow(
    "--confirm must repeat the project ID",
  );

  const executed = await runRelayProjectClear([...args, "--confirm", "alpha"], fixture.databaseUrl);
  expect(executed).toMatchObject({ executed: true, before: dryRun.before });
  // Nothing of the project is readable any more, even before cleanup runs.
  const missing = await sync.blobs.read(cleared.blob, 0).then(
    () => null,
    (error: unknown) => error,
  );
  expect(missing).toBeInstanceOf(SyncRejection);
  expect(await sync.documents.read(cleared.shared, 0)).toMatchObject({ lastSequence: 0, updates: [] });

  // A device that reconnects before cleanup has removed a blob cannot upload it again yet.
  const reupload = () =>
    sync.blobs.begin(cleared.blob, device, { sha256: sha256(cleared.bytes), byteLength: cleared.bytes.length });
  const early = await reupload().then(
    () => null,
    (error: unknown) => error,
  );
  expect(early).toBeInstanceOf(SyncRejection);
  expect((early as SyncRejection).status).toBe(400);

  await sync.cleanup();
  expect([...(await fixture.objects()).keys()].sort()).toEqual(keptObjects);
  // Only the project record stays, for the project to sync again.
  expect((await rowsWith(alpha)).map((row) => row.split(" ")[0])).toEqual(["relay_sync_projects"]);

  // After cleanup, a device that reconnects uploads the same blob and document again from its local copy.
  await reupload();
  await sync.blobs.writePart(cleared.blob, 1, {
    sha256: sha256(cleared.bytes),
    byteLength: cleared.bytes.length,
    body: body(cleared.bytes),
  });
  await sync.blobs.finish(cleared.blob);
  expect(
    await sync.documents.appendUpdate(cleared.shared, device, {
      updateId: randomId("update"),
      payload: encode(new Uint8Array([1])),
      blobIds: [cleared.blob.blobId],
    }),
  ).toEqual({ sequence: 1, duplicate: false });
  expect((await sync.blobs.read(cleared.blob, 0)).byteLength).toBe(48);

  // The account's other project and another account's project of the same ID still read back in full.
  for (const { shared, blob } of [kept, foreign]) {
    expect(await sync.documents.read(shared, 1)).toMatchObject({ lastSequence: 2 });
    expect((await sync.blobs.read(blob, 0)).byteLength).toBe(48);
  }
});
