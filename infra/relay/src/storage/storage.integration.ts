import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { type Asset, canonicalJson, fingerprint, type Scope, sealMutation } from "pstdio-sync-contracts";
import { createConformanceObjects } from "pstdio-sync-contracts/conformance";
import { createRelayStorage, migrateRelayStorage } from "./storage";

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL;
const objectEndpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT;
if (!databaseUrl || !objectEndpoint) throw new Error("Run this file through the isolated conformance runner");
const objects = createConformanceObjects(objectEndpoint);
const assets = { complete: async (scope: Scope, asset: Asset) => (await objects.get(scope, asset)) !== null };
let storage: Awaited<ReturnType<typeof createRelayStorage>>;

beforeAll(async () => {
  await objects.initialize();
  await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
  storage = await createRelayStorage(databaseUrl, assets);
});
afterAll(async () => {
  await storage?.close();
  objects.close();
});

test("a complete record and image group retains its receipt after reopening PostgreSQL", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-notes-1");
  const bytes = new TextEncoder().encode("complete image");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/png",
  };
  await objects.put(scope, asset, bytes);
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: "laptop-a",
    operationId: crypto.randomUUID(),
    parents: [],
    changes: [
      {
        recordId: "note",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "saved" },
      },
      { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
    ],
  });
  const receipt = await owner.submit(mutation);
  expect(receipt.status).toBe("accepted");
  expect(receipt.checkpoint?.sequence).toBe(1);
  await storage.close();
  storage = await createRelayStorage(databaseUrl, assets);
  const reopened = storage.owner(scope);
  expect(await reopened.submit(mutation)).toEqual(receipt);
  const snapshot = await reopened.snapshot();
  expect(snapshot.records.note.value).toBe("saved");
  expect(snapshot.records.image.asset).toEqual(asset);
  expect(snapshot.journalSequence).toBe(1);
  expect(canonicalJson(snapshot.receipts[mutation.operationId])).toBe(canonicalJson(receipt));
  const replay = await reopened.replay({ epoch: snapshot.checkpoint.epoch, sequence: 0 });
  expect(replay.status).toBe("replay");
  if (replay.status !== "replay") throw new Error("Expected durable replay");
  expect(replay.batch.groups).toEqual([receipt]);
});

const replacement = async (scope: Scope, value: string, operationId: string = crypto.randomUUID()) =>
  sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: value,
    operationId,
    parents: [],
    changes: [
      {
        recordId: "note",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: value },
      },
      {
        recordId: "caption",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: value },
      },
    ],
  });

test("independent PostgreSQL connections retain a complete competing group", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-notes-1");
  const second = await createRelayStorage(databaseUrl, assets);
  try {
    const firstMutation = await replacement(scope, "first");
    const secondMutation = await replacement(scope, "second");
    const receipts = await Promise.all([owner.submit(firstMutation), second.owner(scope).submit(secondMutation)]);
    expect(receipts.map((receipt) => receipt.status).sort()).toEqual(["accepted", "conflict"]);
    const snapshot = await owner.snapshot();
    expect(snapshot.records.note.value).toBe(snapshot.records.caption.value);
    expect(snapshot.checkpoint.sequence).toBe(1);
    expect(snapshot.journalSequence).toBe(2);
    const conflict = receipts.find((receipt) => receipt.status === "conflict")!;
    expect(snapshot.conflicts[conflict.conflictId!].recordIds).toEqual(["note", "caption"]);
    expect(snapshot.receipts[conflict.operationId].mutation.changes).toHaveLength(2);
    const unrelated = await replacement(scope, "independent");
    unrelated.changes[0].recordId = "other-note";
    unrelated.changes[1].recordId = "other-caption";
    expect((await owner.submit(await sealMutation(unrelated))).status).toBe("accepted");
  } finally {
    await second.close();
  }
});

test("missing immutable bytes withhold every record until the exact operation can complete", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-notes-1");
  const bytes = new TextEncoder().encode("later image");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/png",
  };
  const input = await replacement(scope, "pending");
  input.changes[1].asset = { base: null, next: asset };
  const mutation = await sealMutation(input);
  const pending = await owner.submit(mutation);
  expect(pending.status).toBe("pending");
  expect(pending.checkpoint).toBeNull();
  expect(Object.keys((await owner.snapshot()).records)).toHaveLength(0);
  await objects.put(scope, asset, bytes);
  const accepted = await owner.submit(mutation);
  expect(accepted.status).toBe("accepted");
  expect(accepted.order).toBe(pending.order);
  expect((await owner.snapshot()).records.caption.asset).toEqual(asset);
  const changed = await replacement(scope, "different", mutation.operationId);
  await expect(owner.submit(changed)).rejects.toThrow("identity");
  expect((await owner.snapshot()).receipts[mutation.operationId]).toEqual(accepted);
});

test("scoped owners reject redirected input and require snapshots for invalid replay cursors", async () => {
  const operationId = crypto.randomUUID();
  const scope = { accountId: "owner-a", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const otherScope = { ...scope, accountId: "owner-b" };
  const owner = await storage.initialize(scope, "published-notes-1");
  const other = await storage.initialize(otherScope, "published-notes-1");
  const input = await replacement(scope, "owner-a", operationId);
  await expect(other.submit(input)).rejects.toThrow("scope");
  await owner.submit(input);
  await other.submit(await replacement(otherScope, "owner-b", operationId));
  expect((await owner.snapshot()).records.note.value).toBe("owner-a");
  const snapshot = await other.snapshot();
  expect(snapshot.records.note.value).toBe("owner-b");
  expect((await other.replay({ epoch: "old-lineage", sequence: 0 })).status).toBe("snapshot-required");
  expect((await other.replay({ ...snapshot.checkpoint, sequence: 100 })).status).toBe("snapshot-required");
  for (const sequence of [Number.NaN, 0.5])
    expect((await other.replay({ ...snapshot.checkpoint, sequence })).status).toBe("snapshot-required");
});

test("restore requires historical asset bytes retained by authoritative receipts", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "images" };
  const owner = await storage.initialize(scope, "published-images-1");
  const versions: Asset[] = [];
  for (const text of ["first image", "second image"]) {
    const bytes = new TextEncoder().encode(text);
    const asset = {
      sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length,
      mediaType: "image/png",
    };
    await objects.put(scope, asset, bytes);
    const previous = versions.at(-1) ?? null;
    const receipt = await owner.submit(
      await sealMutation({
        protocolVersion: 1,
        scope,
        environmentId: "laptop",
        operationId: crypto.randomUUID(),
        parents: [],
        changes: [
          {
            recordId: "image",
            expectedRevision: versions.length,
            baseDeleted: false,
            asset: { base: previous, next: asset },
          },
        ],
      }),
    );
    expect(receipt.status).toBe("accepted");
    versions.push(asset);
  }
  const saved = await owner.snapshot();
  expect(saved.records.image.asset).toEqual(versions[1]);
  await objects.remove(scope, versions[0]);
  const error = await owner.restore(saved).then(
    () => null,
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toContain("incomplete assets");
  expect(await owner.snapshot()).toEqual(saved);
});

test("restore starts a new replay lineage while preserving original acknowledgments", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-1");
  const mutation = await replacement(scope, "saved");
  const receipt = await owner.submit(mutation);
  const saved = await owner.snapshot();
  await owner.publishRevision("published-1", "published-2");
  await owner.restore(saved);
  const restored = await owner.snapshot();
  expect(restored.checkpoint.epoch).not.toBe(saved.checkpoint.epoch);
  expect(restored.checkpoint.sequence).toBe(saved.checkpoint.sequence);
  expect(restored.publishedRevision).toBe("published-1");
  expect(await owner.submit(mutation)).toEqual(receipt);
  expect((await owner.replay(saved.checkpoint)).status).toBe("snapshot-required");
  expect((await owner.replay({ ...restored.checkpoint, sequence: 0 })).status).toBe("snapshot-required");
  const next = await replacement(scope, "next");
  for (const change of next.changes) change.recordId = `next-${change.recordId}`;
  const accepted = await owner.submit(await sealMutation(next));
  const replay = await owner.replay(restored.checkpoint);
  expect(replay.status).toBe("replay");
  if (replay.status !== "replay") throw new Error("Expected replay after restored boundary");
  expect(replay.batch.groups).toEqual([accepted]);
  expect(replay.batch.through.sequence).toBe(2);
});
