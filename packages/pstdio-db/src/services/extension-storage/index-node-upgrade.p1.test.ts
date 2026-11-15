import { expect, test } from "bun:test";
import { like } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_documents, storage_ordered_owners } from "../../db/schemas.pg";
import { createMemoryIndexNodeFiles } from "./index-node-files";
import { upgradeIndexNodesToFiles } from "./index-node-upgrade";
import { orderedIndexBlobDocumentId } from "./ordered-receipts-blobs";
import { encodeOrderedJson } from "./ordered-sql";

// Blob ids are at least 16 characters; padding keeps the readable names distinct.
const id = (name: string) => name.padEnd(16, "x");
const reference = (name: string) => ({ blobId: id(name), byteLength: 4 });

const setup = async () => {
  const database = await createDb({ path: ":memory:" });
  const workbenchId = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.db
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
  return { ...database, workbenchId, row };
};

test("the upgrade keeps reachable receipt nodes as files, drops every node row and compacts once", async () => {
  const { db, close, workbenchId, row } = await setup();
  try {
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
      workbench_id: workbenchId,
      extension_id: records.extensionId,
      receipt_root: encodeOrderedJson({
        version: 1,
        root: { blobId: id("root"), byteLength: 9 },
        published: { blobId: id("published"), byteLength: 14 },
        stateId: null,
      }),
    });
    const files = createMemoryIndexNodeFiles();
    const progress: unknown[] = [];
    await upgradeIndexNodesToFiles(db, files, (step) => progress.push(step));

    expect((await files.list(records, "receipts")).sort()).toEqual(["C", "b", "published", "root"].map(id));
    expect(await files.read(records, "receipts", id("root"))).toEqual({
      bytes: new Uint8Array(Buffer.from("node-root")),
      children: [reference("C"), reference("b")],
    });
    expect((await files.read(records, "receipts", id("C")))?.children).toBeNull();
    // History nodes are a relay cache: dropped, then downloaded again on demand.
    expect(await files.list(logs, "receipts")).toEqual([]);
    expect(await files.list(logs, "logs")).toEqual([]);
    expect(
      await db.select().from(storage_documents).where(like(storage_documents.document_id, '["ordered-index-blob",%')),
    ).toEqual([]);
    expect(progress).toEqual([
      { owner: logs, kept: 0, removed: 2 },
      { owner: records, kept: 4, removed: 5 },
      { compacted: true },
    ]);
    expect(await files.marker("index-nodes-compact-pending").exists()).toBe(false);

    const again: unknown[] = [];
    await upgradeIndexNodesToFiles(db, files, (step) => again.push(step));
    expect(again).toEqual([]);
  } finally {
    await close();
  }
});

test("an upgrade interrupted after moving rows finishes the compaction on the next start", async () => {
  const { db, close } = await setup();
  try {
    const files = createMemoryIndexNodeFiles();
    await files.marker("index-nodes-compact-pending").set();
    const progress: unknown[] = [];
    await upgradeIndexNodesToFiles(db, files, (step) => progress.push(step));
    expect(progress).toEqual([{ compacted: true }]);
    expect(await files.marker("index-nodes-compact-pending").exists()).toBe(false);
  } finally {
    await close();
  }
});
