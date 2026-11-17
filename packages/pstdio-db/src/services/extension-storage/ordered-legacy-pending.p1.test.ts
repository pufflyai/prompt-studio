import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  storage_document_updates,
  storage_documents,
  storage_ordered_operations,
  storage_ordered_owners,
  storage_record_outbox,
} from "../../db/schemas.pg";
import { peers } from "./ordered-legacy-pending.fixture";
import { resourceDocumentId } from "./resource-document-persistence";

test("an upgrade retains a legacy offline frame after another full writer founds the ordered stream", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({
    operationId: "seed",
    edits: [{ recordId: "card", replace: { title: "shared base", status: "todo" } }],
  });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({
    operationId: "offline",
    edits: [{ recordId: "card", replace: { title: "offline unsynced", status: "todo" } }],
  });
  expect(await second.db.select().from(storage_record_outbox)).toHaveLength(1);
  const a = first.upgrade();
  const b = second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  for (const peer of [a, b])
    expect((await peer.records.read("card")).value).toEqual({ title: "offline unsynced", status: "todo" });
  const migrated = await second.db.select().from(storage_ordered_operations);
  expect(migrated.filter((row) => row.operation_id.startsWith("legacy-pending:"))).toHaveLength(1);
  await second.upgrade().sync.synchronize();
  expect(
    (await second.db.select().from(storage_ordered_operations)).filter((row) =>
      row.operation_id.startsWith("legacy-pending:"),
    ),
  ).toHaveLength(1);
});

test("a pending legacy native field binding carries its actual seeded text history through foreign adoption", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { body: "base" } }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  const binding = await second.legacy.bindText({ recordId: "card", field: "/body", documentKey: "d".repeat(64) });
  await second.legacy.commit({
    operationId: "native-offline",
    edits: [{ recordId: "card", replace: { body: "offline native" } }],
  });
  const a = first.upgrade();
  const b = second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  for (const peer of [a, b]) expect((await peer.records.read("card")).value).toEqual({ body: "offline native" });
  expect(await first.native(binding.documentKey).read()).toBe("offline native");
  expect(await second.native(binding.documentKey).read()).toBe("offline native");
});

test("pending legacy assets and delete/restore frames survive upgrade without losing retained content", async () => {
  const { first, second } = await peers();
  const original = new TextEncoder().encode("retained original");
  const hash = new Bun.CryptoHasher("sha256").update(original).digest("hex");
  const asset = { sha256: hash, byteLength: original.length, mediaType: "text/plain" };
  first.assets.files.set(hash, original);
  await first.legacy.commit({
    operationId: "seed-assets",
    edits: [
      { recordId: "doomed", replace: { body: "retained" }, asset },
      { recordId: "restored", replace: { body: "before" } },
      { recordId: "file", replace: { title: "base" } },
    ],
  });
  await first.legacy.commit({ operationId: "seed-delete", edits: [{ recordId: "restored", deleted: true }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  const bytes = new TextEncoder().encode("pending replacement");
  const pendingHash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const replacement = { sha256: pendingHash, byteLength: bytes.length, mediaType: "text/plain" };
  second.assets.files.set(pendingHash, bytes);
  await second.legacy.commit({ operationId: "pending-file", edits: [{ recordId: "file", asset: replacement }] });
  await second.legacy.commit({
    operationId: "pending-life",
    edits: [
      { recordId: "doomed", deleted: true },
      { recordId: "restored", deleted: false, replace: { body: "restored offline" } },
    ],
  });
  const a = first.upgrade();
  const b = second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  for (const peer of [a, b]) {
    expect((await peer.records.read("doomed")).deleted).toBe(true);
    expect((await peer.records.read("restored")).value).toEqual({ body: "restored offline" });
    expect((await peer.records.read("file")).asset).toEqual(replacement);
  }
  expect(first.assets.files.get(pendingHash)).toEqual(bytes);
  await a.records.commit({ operationId: "restore-v2", edits: [{ recordId: "doomed", deleted: false }] });
  await a.sync.synchronize();
  await b.sync.synchronize();
  expect((await b.records.read("doomed")).asset).toEqual(asset);
  expect((await b.records.read("doomed")).value).toEqual({ body: "retained" });
});

test("the first explicit shared-text edits after migrating a pending legacy text share one canonical genesis", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({
    operationId: "shared-seed",
    edits: [{ recordId: "text", replace: {}, shared: [{ kind: "text.insert", index: 0, text: "base" }] }],
  });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({
    operationId: "shared-offline",
    edits: [{ recordId: "text", shared: [{ kind: "text.insert", index: 4, text: " offline" }] }],
  });
  const a = first.upgrade();
  const b = second.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  for (const [peer, text] of [
    [a, "A"],
    [b, "B"],
  ] as const)
    await peer.records.commit({
      operationId: `shared-${text}`,
      edits: [{ recordId: "text", shared: [{ kind: "text.insert", index: 0, text }] }],
    });
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  const value = (await a.records.read("text")).shared;
  expect((await b.records.read("text")).shared).toEqual(value);
  expect(value?.value).toContain("A");
  expect(value?.value).toContain("B");
  expect(value?.value).toEndWith("base offline");
});

test("upgraded pending paths keep whole arrays and multiline text without replacing clean peer fields", async () => {
  const { first, second } = await peers();
  const base = {
    title: "base",
    status: "todo",
    nested: { x: 1, y: 2 },
    tags: { a: true, b: true },
    list: [1, 2],
    body: "base\ntext",
  };
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: base }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({
    operationId: "offline-pair",
    edits: [
      {
        recordId: "card",
        replace: {
          ...base,
          title: "offline",
          tags: { a: true, d: true },
          newBranch: { local: true },
          list: [3],
          body: "offline\nwhole",
        },
      },
      { recordId: "audit", replace: { saved: true } },
    ],
  });
  const a = first.upgrade();
  await a.records.commit({
    operationId: "peer-fields",
    edits: [
      { recordId: "card", set: { "/status": "remote", "/nested/y": 9, "/tags/c": true, "/newBranch/peer": true } },
    ],
  });
  await a.sync.synchronize();
  const b = second.upgrade();
  await b.sync.synchronize();
  await a.sync.synchronize();
  const expected = {
    ...base,
    title: "offline",
    status: "remote",
    nested: { x: 1, y: 9 },
    tags: { a: true, c: true, d: true },
    newBranch: { local: true, peer: true },
    list: [3],
    body: "offline\nwhole",
  };
  for (const peer of [a, b]) {
    expect((await peer.records.read("card")).value).toEqual(expected);
    expect((await peer.records.read("audit")).value).toEqual({ saved: true });
  }
  const [migrated] = (await second.db.select().from(storage_ordered_operations)).filter((row) =>
    row.operation_id.startsWith("legacy-pending:"),
  );
  expect(migrated?.envelope).not.toBeNull();
  expect(JSON.parse(new TextDecoder().decode(migrated!.envelope!)).edits).toHaveLength(2);
});

for (const restoring of [false, true])
  test(`a new conditional child observes the migrated pending ${restoring ? "restore" : "delete"} occurrence before connect`, async () => {
    const { first, second } = await peers();
    await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { body: "base" } }] });
    if (restoring)
      await first.legacy.commit({ operationId: "base-delete", edits: [{ recordId: "card", deleted: true }] });
    await first.oldSync.synchronize();
    await second.oldSync.synchronize();
    await second.legacy.commit({
      operationId: "pending-life",
      edits: [
        { recordId: "card", deleted: !restoring, ...(restoring ? { replace: { body: "restored offline" } } : {}) },
      ],
    });
    const b = second.upgrade();
    const observed = await b.records.read("card");
    expect(observed.deleted).toBe(!restoring);
    await b.records.commit({
      operationId: "new-child",
      edits: [
        {
          recordId: "card",
          expectedRevision: observed.revision,
          ...(restoring ? {} : { deleted: false }),
          replace: { body: "child" },
        },
      ],
    });
    const a = first.upgrade();
    await a.sync.synchronize();
    await b.sync.synchronize();
    await a.sync.synchronize();
    expect((await b.records.outcome("new-child"))?.state).toBe("synced");
    for (const peer of [a, b]) expect((await peer.records.read("card")).value).toEqual({ body: "child" });
  });

test("overlapping old frames retain latest authored intent and original frame evidence exactly once", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({
    operationId: "seed",
    edits: [{ recordId: "card", replace: { title: "base", status: "old" } }],
  });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  for (const title of ["earlier pending", "latest pending"])
    await second.legacy.commit({
      operationId: title,
      edits: [{ recordId: "card", replace: { title, status: "old" } }],
    });
  const evidence = (await second.db.select().from(storage_record_outbox)).map((row) => row.frame);
  const a = first.upgrade();
  await a.records.commit({ operationId: "peer", edits: [{ recordId: "card", set: { "/status": "remote" } }] });
  await a.sync.synchronize();
  const b = second.upgrade();
  await b.sync.synchronize();
  await a.sync.synchronize();
  expect((await a.records.read("card")).value).toEqual({ title: "latest pending", status: "remote" });
  expect((await b.records.read("card")).value).toEqual({ title: "latest pending", status: "remote" });
  expect((await second.db.select().from(storage_record_outbox)).map((row) => row.frame)).toEqual(evidence);
  expect(
    (await second.db.select().from(storage_ordered_operations)).filter((row) =>
      row.operation_id.startsWith("legacy-pending:"),
    ),
  ).toHaveLength(1); // The earlier write is fully superseded; both original frames remain above as evidence.
});

test("missing legacy causal source leaves a resumable conversion while pending frame bytes remain", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: "base" }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({ operationId: "offline", edits: [{ recordId: "card", replace: "pending" }] });
  const evidence = await second.db.select().from(storage_record_outbox);
  const [source] = await second.db
    .select()
    .from(storage_documents)
    .where(eq(storage_documents.document_id, resourceDocumentId("card")));
  const updates = await second.db
    .select()
    .from(storage_document_updates)
    .where(eq(storage_document_updates.document_id, resourceDocumentId("card")));
  await second.db.delete(storage_documents).where(eq(storage_documents.document_id, resourceDocumentId("card")));
  await expect(second.upgrade().records.read("card")).rejects.toThrow("missing its conversion source");
  expect(await second.db.select().from(storage_ordered_owners)).toHaveLength(1);
  expect(await second.db.select().from(storage_ordered_operations)).toHaveLength(0);
  expect(await second.db.select().from(storage_record_outbox)).toEqual(evidence);
  await second.db.insert(storage_documents).values(source!);
  if (updates.length) await second.db.insert(storage_document_updates).values(updates);
  expect((await second.upgrade().records.read("card")).value).toBe("pending");
});

test("a conditional child of a newly created legacy pending record resolves the same creation occurrence", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({ operationId: "base", edits: [{ recordId: "base", replace: true }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await second.legacy.commit({
    operationId: "new-offline",
    edits: [{ recordId: "new", replace: { title: "pending" } }],
  });
  const b = second.upgrade();
  const observed = await b.records.read("new");
  await b.records.commit({
    operationId: "new-child",
    edits: [{ recordId: "new", expectedRevision: observed.revision, set: { "/title": "child" } }],
  });
  const a = first.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  expect((await b.records.outcome("new-child"))?.state).toBe("synced");
  expect((await a.records.read("new")).value).toEqual({ title: "child" });
});

test("old native-only unsynced typing and its new conditional child survive ordered adoption", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { body: "base" } }] });
  const bound = await first.legacy.bindText({ recordId: "card", field: "/body", documentKey: "f".repeat(64) });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  await (await first.oldNativeSync(bound.documentKey)).synchronize();
  await (await second.oldNativeSync(bound.documentKey)).synchronize();
  await second.native(bound.documentKey).save("offline native");
  expect(await second.db.select().from(storage_record_outbox)).toHaveLength(0);
  const b = second.upgrade();
  const observed = await b.records.read("card");
  expect(observed.value).toEqual({ body: "offline native" });
  await b.records.commit({
    operationId: "native-child",
    edits: [{ recordId: "card", expectedRevision: observed.revision, set: { "/body": "offline native child" } }],
  });
  const a = first.upgrade();
  await a.sync.synchronize();
  await b.sync.synchronize();
  await a.sync.synchronize();
  expect((await b.records.outcome("native-child"))?.state).toBe("synced");
  for (const peer of [first, second]) expect(await peer.native(bound.documentKey).read()).toBe("offline native child");
});
