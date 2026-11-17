import { afterEach, expect, test } from "bun:test";
import { collectionMoveMarkerId, storageRecordId } from "pstdio-sync/records";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { getExtensionStorageOwner } from "./storage-owner";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const setup = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const scope = { extension_instance_id: f.instanceAId, scope_type: "project", scope_id: f.projectAId };
  const tickets = { ...scope, collection: "tickets" };
  const owner = (await getExtensionStorageOwner(f.db, f.instanceAId))!;
  const moved = (key: string) => storageRecordId(["project", f.projectAId, "kv"], key);
  const legacy = (id: string) => storageRecordId(["project", f.projectAId, "collection", "tickets"], id);
  const move = (keyPrefix = "ticket:", version = 1) =>
    f.svc.migrate(scope, version, async () => {
      result = await f.svc.moveCollection(tickets, keyPrefix);
    });
  let result: { moved: number } | undefined;
  return { ...f, scope, tickets, owner, moved, legacy, move, result: () => result };
};

test("moving a collection unwraps each item into its record and keeps the collection API working", async () => {
  const f = await setup();
  await f.svc.setCollectionItem({ ...f.tickets, item_id: "a", value_json: { title: "A" }, project_id: f.projectAId });
  await f.svc.setCollectionItem({
    ...f.tickets,
    item_id: "b",
    value_json: { title: "B" },
    sort_order: 2,
    project_id: f.projectAId,
  });

  await f.move();

  expect(f.result()).toEqual({ moved: 2 });
  const records = createDocumentStorageDBService(f.db).open({ owner: f.owner }).records;
  expect((await records.read(f.moved("ticket:a"))).value).toEqual({ title: "A" });
  expect((await records.read(f.legacy("a"))).deleted).toBe(true);
  expect((await records.read(collectionMoveMarkerId("project", f.projectAId, "tickets"))).value).toEqual({
    keyPrefix: "ticket:",
  });
  // Old-format callers read, update and create through the moved records.
  expect(await f.svc.getCollectionItem(f.tickets, "a")).toMatchObject({ item_id: "a", value_json: { title: "A" } });
  expect(await f.svc.updateCollectionItem({ ...f.tickets, item_id: "b", value_json: { title: "B2" } })).toBe(true);
  await f.svc.setCollectionItem({ ...f.tickets, item_id: "c", value_json: { title: "C" }, project_id: f.projectAId });
  expect((await records.read(f.moved("ticket:b"))).value).toEqual({ title: "B2" });
  expect((await records.read(f.moved("ticket:c"))).value).toEqual({ title: "C" });
  expect((await records.read(f.legacy("c"))).exists).toBe(false);
  expect((await f.svc.listCollection(f.tickets)).map((item) => [item.item_id, item.value_json])).toEqual([
    ["a", { title: "A" }],
    ["b", { title: "B2" }],
    ["c", { title: "C" }],
  ]);
  expect(await f.svc.deleteCollectionItem(f.tickets, "c")).toBe(true);
  expect((await records.read(f.moved("ticket:c"))).deleted).toBe(true);
});

test("a moved item keeps its text history and its open editor keeps saving to it", async () => {
  const f = await setup();
  await f.svc.setCollectionItem({
    ...f.tickets,
    item_id: "a",
    value_json: { title: "A", content: "first" },
    project_id: f.projectAId,
  });
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner: f.owner }).records;
  const documentKey = "d".repeat(64);
  await records.bindText({ recordId: f.legacy("a"), field: "/value/content", documentKey });
  const editor = service.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
  await editor.save("first edit");

  await f.move();

  expect((await records.read(f.moved("ticket:a"))).value).toEqual({ title: "A", content: "first edit" });
  expect(await editor.read()).toBe("first edit");
  await editor.save("first edit, after the move");
  expect((await records.read(f.moved("ticket:a"))).value).toEqual({
    title: "A",
    content: "first edit, after the move",
  });
  // Plain record writes reach the same text document.
  await records.commit({
    operationId: "edit-after-move",
    edits: [{ recordId: f.moved("ticket:a"), replace: { title: "A", content: "record write" } }],
  });
  expect(await editor.read()).toBe("record write");
  // Declaring the moved field as a record source finds the same text document.
  const declared = { recordId: f.moved("ticket:a"), documentKey: "e".repeat(64), field: "/content" };
  expect((await f.svc.resolveNativeRecordAddress(f.owner, declared)).documentKey).toBe(documentKey);
  expect((await records.bindText({ ...declared, documentKey, sourceKey: declared.documentKey })).documentKey).toBe(
    documentKey,
  );
});

test("a rerun moves nothing, a different key prefix is refused, and a taken target fails the move", async () => {
  const f = await setup();
  await f.svc.setCollectionItem({ ...f.tickets, item_id: "a", value_json: { title: "A" }, project_id: f.projectAId });
  await f.move();
  await f.move("ticket:", 2);
  expect(f.result()).toEqual({ moved: 0 });
  await expect(f.move("other:", 3)).rejects.toThrow("already moved to key prefix ticket:");

  const g = await setup();
  await g.svc.setCollectionItem({ ...g.tickets, item_id: "a", value_json: { title: "A" }, project_id: g.projectAId });
  await g.svc.setKv({ ...g.scope, key: "ticket:a", value_json: { other: true }, project_id: g.projectAId });
  await expect(g.move()).rejects.toThrow("already exists");
  expect(await g.svc.getCollectionItem(g.tickets, "a")).toMatchObject({ value_json: { title: "A" } });
});

test("a collection moves only inside storage.migrate", async () => {
  const f = await setup();
  await expect(f.svc.moveCollection(f.tickets, "ticket:")).rejects.toThrow("only move inside storage.migrate");
});

test("restoring a point from before the move brings the items back and the move runs again", async () => {
  const f = await setup();
  await f.svc.setCollectionItem({ ...f.tickets, item_id: "a", value_json: { title: "A" }, project_id: f.projectAId });
  await f.svc.recovery.capture(f.projectAId, new Date("2026-11-16T10:00:00Z"));
  const [before] = await f.svc.recovery.list(f.projectAId);
  await f.move();
  const records = createDocumentStorageDBService(f.db).open({ owner: f.owner }).records;

  await f.svc.recovery.restore(f.projectAId, { hours: before!.hours, capturedAt: before!.capturedAt });

  expect((await records.read(f.legacy("a"))).value).toEqual({ value: { title: "A" }, sortOrder: null });
  expect((await records.read(f.moved("ticket:a"))).deleted).toBe(true);
  expect(await f.svc.getCollectionItem(f.tickets, "a")).toMatchObject({ value_json: { title: "A" } });
  await f.move();
  expect(f.result()).toEqual({ moved: 1 });
  expect((await records.read(f.moved("ticket:a"))).value).toEqual({ title: "A" });

  // A point taken after the move restores the moved record like any other record.
  await f.svc.recovery.capture(f.projectAId, new Date("2026-11-16T12:00:00Z"));
  const after = (await f.svc.recovery.list(f.projectAId)).find((point) => point.capturedAt !== before!.capturedAt)!;
  await f.svc.updateCollectionItem({ ...f.tickets, item_id: "a", value_json: { title: "A changed" } });
  await f.svc.recovery.restore(f.projectAId, { hours: after.hours, capturedAt: after.capturedAt });
  expect(await f.svc.getCollectionItem(f.tickets, "a")).toMatchObject({ value_json: { title: "A" } });
});
