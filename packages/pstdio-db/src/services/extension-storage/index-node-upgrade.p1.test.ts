import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { like } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_documents, storage_ordered_owners } from "../../db/schemas.pg";
import { createIndexNodeFiles, createMemoryIndexNodeFiles } from "./index-node-files";
import { upgradeIndexNodesToFiles } from "./index-node-upgrade";
import { orderedIndexBlobDocumentId } from "./ordered-receipts-blobs";
import { encodeOrderedJson } from "./ordered-sql";
import { ensureStorageOwner } from "./storage-owner-key";

// Blob ids are at least 16 characters; padding keeps the readable names distinct.
const id = (name: string) => name.padEnd(16, "x");
const reference = (name: string) => ({ blobId: id(name), byteLength: 4 });
const nodeRows = like(storage_documents.document_id, '["ordered-index-blob",%');
const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

type Db = Awaited<ReturnType<typeof createDb>>["db"];
const seed = async (db: Db, workbenchId = crypto.randomUUID()) => {
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: workbenchId, name: "Upgrade", shorthand: "U", created_at: now, updated_at: now });
  const row = (extensionId: string, name: string, children: string[] | null) => ({
    workbench_id: workbenchId,
    extension_id: extensionId,
    document_id: orderedIndexBlobDocumentId(id(name)),
    state: encodeOrderedJson({
      version: 1,
      bytes: Buffer.from(`node-${name}`).toString("base64"),
      children: children?.map(reference) ?? null,
    }),
  });
  const records = { workbenchId, extensionId: "example.records" };
  const logs = { workbenchId, extensionId: "example.history" };
  // Rows from before the upgrade stored children in locale order ("b" before "C").
  await db
    .insert(storage_documents)
    .values([
      row(records.extensionId, "root", ["b", "C"]),
      row(records.extensionId, "b", []),
      row(records.extensionId, "C", null),
      row(records.extensionId, "published", ["b"]),
      row(records.extensionId, "replaced", ["b"]),
      row(logs.extensionId, "log-page", []),
      row(logs.extensionId, "log-root", ["log-page"]),
    ]);
  await db.insert(storage_ordered_owners).values({
    owner_id: await ensureStorageOwner(db, records),
    receipt_root: encodeOrderedJson({
      version: 1,
      root: { blobId: id("root"), byteLength: 9 },
      published: { blobId: id("published"), byteLength: 14 },
      stateId: null,
    }),
  });
  return { records, logs, workbenchId };
};

test("the upgrade keeps reachable receipt nodes as files and drops every node row", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const { records, logs } = await seed(db);
    const files = createMemoryIndexNodeFiles();
    const progress: unknown[] = [];
    expect(await upgradeIndexNodesToFiles(db, files, (step) => progress.push(step))).toBe(true);

    expect((await files.list(records, "receipts")).sort()).toEqual(["C", "b", "published", "root"].map(id));
    expect(await files.read(records, "receipts", id("root"))).toEqual({
      bytes: new Uint8Array(Buffer.from("node-root")),
      children: [reference("C"), reference("b")],
    });
    expect((await files.read(records, "receipts", id("C")))?.children).toBeNull();
    // History nodes are a relay cache: dropped, then downloaded again on demand.
    expect(await files.list(logs, "receipts")).toEqual([]);
    expect(await files.list(logs, "logs")).toEqual([]);
    expect(await db.select().from(storage_documents).where(nodeRows)).toEqual([]);
    expect(progress).toEqual([
      { owner: logs, kept: 0, removed: 2 },
      { owner: records, kept: 4, removed: 5 },
    ]);
    expect(await upgradeIndexNodesToFiles(db, files)).toBe(false);
  } finally {
    await close();
  }
});

test("an owner with an unreadable row keeps its rows while other owners move", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const { records, logs, workbenchId } = await seed(db);
    await db.insert(storage_documents).values({
      workbench_id: workbenchId,
      extension_id: records.extensionId,
      document_id: orderedIndexBlobDocumentId(id("broken")),
      state: encodeOrderedJson(null),
    });
    await db.update(storage_ordered_owners).set({
      receipt_root: encodeOrderedJson({
        version: 1,
        root: { blobId: id("broken"), byteLength: 1 },
        published: null,
        stateId: null,
      }),
    });
    const files = createMemoryIndexNodeFiles();
    expect(await upgradeIndexNodesToFiles(db, files)).toBe(true);
    const left = await db.select({ owner: storage_documents.extension_id }).from(storage_documents).where(nodeRows);
    expect(new Set(left.map((row) => row.owner))).toEqual(new Set([records.extensionId]));
    expect(await files.list(logs, "logs")).toEqual([]);
  } finally {
    await close();
  }
});

test("opening an on-disk database moves its node rows into the folder beside it and keeps them across restarts", async () => {
  const folder = await mkdtemp(join(tmpdir(), "index-node-open-"));
  folders.push(folder);
  const path = join(folder, "pstdio.db");
  const first = await createDb({ path });
  // Rows written by an older release, before the folder existed.
  const { records } = await seed(first.db);
  await first.close();

  const reopened = await createDb({ path });
  try {
    expect(await reopened.db.select().from(storage_documents).where(nodeRows)).toEqual([]);
    const files = createIndexNodeFiles(`${path}-index-nodes`);
    expect((await files.list(records, "receipts")).sort()).toEqual(["C", "b", "published", "root"].map(id));
    // A project that no longer exists loses its folder on the next open.
    await reopened.db.delete(projects);
  } finally {
    await reopened.close();
  }
  const emptied = await createDb({ path });
  await emptied.close();
  expect(await createIndexNodeFiles(`${path}-index-nodes`).list(records, "receipts")).toEqual([]);
});

test("runtime startup preserves receipt files and defers stale rows until its maintenance pass", async () => {
  const folder = await mkdtemp(join(tmpdir(), "index-node-background-cleanup-"));
  folders.push(folder);
  const path = join(folder, "pstdio.db");
  const original = await createDb({ path });
  const { records, logs, workbenchId } = await seed(original.db);
  const retired = JSON.stringify(["pstdio.personal-history", "account"]);
  await original.db.insert(storage_documents).values({
    workbench_id: workbenchId,
    extension_id: retired,
    document_id: "transcript",
    state: new Uint8Array([0, 0]),
  });
  await original.db.insert(storage_documents).values(
    Array.from({ length: 64 }, (_, index) => ({
      workbench_id: workbenchId,
      extension_id: logs.extensionId,
      document_id: orderedIndexBlobDocumentId(id(`stale-${index}`)),
      state: new Uint8Array([0, 0]),
    })),
  );
  await original.close();

  const phases: string[] = [];
  const firstRuntime = await createDb({ path, deferCleanup: true, onPhase: (phase) => phases.push(phase) });
  try {
    const files = createIndexNodeFiles(`${path}-index-nodes`);
    expect((await files.list(records, "receipts")).sort()).toEqual(["C", "b", "published", "root"].map(id));
    expect(
      await firstRuntime.db.select({ id: storage_documents.document_id }).from(storage_documents).where(nodeRows),
    ).toHaveLength(71);
    expect(phases).not.toContain("database_compacting");
    let checks = 0;
    await firstRuntime.cleanupRetiredRows(() => ++checks > 3);
    expect(
      await firstRuntime.db.select({ id: storage_documents.document_id }).from(storage_documents).where(nodeRows),
    ).toHaveLength(39);
  } finally {
    await firstRuntime.close();
  }

  const reopened = await createDb({ path, deferCleanup: true });
  try {
    await reopened.cleanupRetiredRows(() => false);
    expect(await reopened.db.select().from(storage_documents).where(nodeRows)).toEqual([]);
    expect(
      await reopened.pglite.query("SELECT extension_id FROM storage_documents WHERE extension_id = $1", [retired]),
    ).toMatchObject({ rows: [] });
    expect(await createIndexNodeFiles(`${path}-index-nodes`).read(records, "receipts", id("root"))).toBeDefined();
  } finally {
    await reopened.close();
  }
});

test("a retried upgrade follows file edges to descendants that still only have rows, and records owed compaction first", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const { records } = await seed(db);
    const files = createMemoryIndexNodeFiles();
    // After a partial run, sync saved a root that exists only as a file and reuses a row-only node.
    await db.update(storage_ordered_owners).set({
      receipt_root: encodeOrderedJson({
        version: 1,
        root: { blobId: id("file-root"), byteLength: 4 },
        published: null,
        stateId: null,
      }),
    });
    await files.write(records, "receipts", id("file-root"), { bytes: new Uint8Array(4), children: [reference("b")] });
    const order: string[] = [];
    await upgradeIndexNodesToFiles(
      db,
      files,
      () => order.push("progress"),
      async () => void order.push("owed"),
    );
    expect(order[0]).toBe("owed");
    expect((await files.list(records, "receipts")).sort()).toEqual(["b", "file-root"].map(id).sort());
    expect(await db.select().from(storage_documents).where(nodeRows)).toEqual([]);
  } finally {
    await close();
  }
});

test("files left under a renamed extension's old id by a crash move on the next start", async () => {
  const folder = await mkdtemp(join(tmpdir(), "index-node-rename-"));
  folders.push(folder);
  const path = join(folder, "pstdio.db");
  const first = await createDb({ path });
  const now = new Date().toISOString();
  const workbenchId = crypto.randomUUID();
  await first.db
    .insert(projects)
    .values({ id: workbenchId, name: "Rename", shorthand: "R", created_at: now, updated_at: now });
  await first.close();
  // The rename committed (no rows under the old id), then the process stopped before moving files.
  const files = createIndexNodeFiles(`${path}-index-nodes`);
  const old = { workbenchId, extensionId: "pstdio.pstdio-planner" };
  await files.write(old, "receipts", id("root"), { bytes: new Uint8Array(4), children: [] });

  const reopened = await createDb({ path });
  await reopened.close();
  expect(await files.list(old, "receipts")).toEqual([]);
  expect(await files.list({ workbenchId, extensionId: "pstdio.planner" }, "receipts")).toEqual([id("root")]);
});
