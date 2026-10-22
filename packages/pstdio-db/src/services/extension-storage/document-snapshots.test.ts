import { afterEach, beforeEach, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createDocumentSnapshots } from "./document-snapshots";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const closes: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closes.splice(0)) await close();
});
const allocateFixture = async () => {
  const f = await createExtensionStorageFixture();
  closes.push(f.close);
  const service = createDocumentStorageDBService(f.db);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const storage = service.open({ owner });
  return { ...f, service, owner, storage };
};
let active: Awaited<ReturnType<typeof allocateFixture>>;
beforeEach(async () => {
  active = await allocateFixture();
});
const fixture = async () => active;

test("three persistent recovery slots rotate independently and keep the exact capture times", async () => {
  const f = await fixture();
  const snapshots = createDocumentSnapshots(f.db);
  await f.storage.records.commit({
    operationId: "seed",
    edits: [{ recordId: "ticket", replace: { title: "Before" } }],
  });
  await snapshots.capture(f.projectAId, new Date("2026-10-20T00:00:00Z"));
  await f.storage.records.commit({ operationId: "edit", edits: [{ recordId: "ticket", replace: { title: "After" } }] });
  await snapshots.capture(f.projectAId, new Date("2026-10-20T01:00:00Z"));
  const rows = await createDocumentSnapshots(f.db).list(f.projectAId);
  expect(rows.map((r) => [r.hours, r.capturedAt])).toEqual([
    [1, "2026-10-20T01:00:00.000Z"],
    [12, "2026-10-20T00:00:00.000Z"],
    [24, "2026-10-20T00:00:00.000Z"],
  ]);
  for (let hour = 2; hour <= 48; hour++) {
    await snapshots.capture(f.projectAId, new Date(Date.UTC(2026, 9, 20, hour)));
    expect(await snapshots.list(f.projectAId)).toHaveLength(3);
  }
});

test("scoped restore recovers records and text, preserves other extensions, and can be undone", async () => {
  const f = await fixture();
  const snapshots = createDocumentSnapshots(f.db);
  const other = f.service.open({ owner: { ...f.owner, extensionId: "other" } });
  const text = f.service.openTextDocument({ owner: f.owner, fileId: "note.md" });
  await f.storage.records.commit({ operationId: "seed", edits: [{ recordId: "ticket", replace: "Before" }] });
  await text.save("Before\ntext");
  await snapshots.capture(f.projectAId);
  const target = (await snapshots.list(f.projectAId))[0];
  await f.storage.records.commit({ operationId: "delete", edits: [{ recordId: "ticket", deleted: true }] });
  await text.save("After");
  await other.records.commit({ operationId: "other", edits: [{ recordId: "note", replace: "Untouched" }] });
  await snapshots.restore(f.projectAId, { ...target, extensionId: f.owner.extensionId });
  expect((await f.storage.records.read("ticket")).value).toBe("Before");
  expect(await text.read()).toBe("Before\ntext");
  expect((await other.records.read("note")).value).toBe("Untouched");
  const undo = (await snapshots.list(f.projectAId))[0];
  await snapshots.restore(f.projectAId, { ...undo, extensionId: f.owner.extensionId });
  expect((await f.storage.records.read("ticket")).deleted).toBe(true);
  expect(await text.read()).toBe("After");
});

test("low disk space retains only the existing 12-hour snapshot and leaves current data intact", async () => {
  const f = await fixture();
  await f.storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Saved work" }] });
  await createDocumentSnapshots(f.db).capture(f.projectAId);
  const twelve = (await createDocumentSnapshots(f.db).list(f.projectAId))[1];
  const limited = createDocumentSnapshots(f.db, { freeBytes: async () => 0 });
  await limited.capture(f.projectAId, new Date(Date.now() + 3600000));
  expect(await limited.list(f.projectAId)).toEqual([twelve]);
  expect((await f.storage.records.read("note")).value).toBe("Saved work");
});

test("stale recovery selections fail without changing project contents", async () => {
  const f = await fixture();
  const snapshots = createDocumentSnapshots(f.db);
  await f.storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Saved" }] });
  await snapshots.capture(f.projectAId);
  const target = (await snapshots.list(f.projectAId))[0];
  await snapshots.capture(f.projectAId, new Date(Date.now() + 3600000));
  await expect(snapshots.restore(f.projectAId, target)).rejects.toThrow("Snapshot changed");
});

test("explicit data removal erases that extension from recovery snapshots", async () => {
  const f = await fixture();
  const snapshots = createDocumentSnapshots(f.db);
  await f.storage.records.commit({ operationId: "private", edits: [{ recordId: "secret", replace: "Private data" }] });
  await snapshots.capture(f.projectAId);
  await createExtensionUserDataDBService(f.db).deleteForInstance(f.instanceAId);
  const target = (await snapshots.list(f.projectAId))[0]!;
  await snapshots.restore(f.projectAId, target);
  expect((await f.storage.records.read("secret")).exists).toBe(false);
});

test("an extension created after the recovery point can be restored to its earlier empty state", async () => {
  const f = await fixture();
  const snapshots = createDocumentSnapshots(f.db);
  await f.storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Keep" }] });
  await snapshots.capture(f.projectAId);
  const other = f.service.open({ owner: { ...f.owner, extensionId: "new" } });
  await other.records.commit({ operationId: "new", edits: [{ recordId: "later", replace: "New" }] });
  const target = (await snapshots.list(f.projectAId))[0]!;
  await snapshots.restore(f.projectAId, { ...target, extensionId: "new" });
  expect((await other.records.read("later")).deleted).toBe(true);
  expect((await f.storage.records.read("note")).value).toBe("Keep");
});

test("an actual database capacity failure retries the 12-hour capture after rollback", async () => {
  const f = await fixture();
  await f.storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Saved" }] });
  await f.db.execute(sql`CREATE FUNCTION fail_optional_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.hours <> 12 THEN RAISE EXCEPTION 'disk full' USING ERRCODE = '53100'; END IF;
      RETURN NEW;
    END $$`);
  await f.db.execute(sql`CREATE TRIGGER limited_snapshot_capacity BEFORE INSERT OR UPDATE ON document_snapshots
    FOR EACH ROW EXECUTE FUNCTION fail_optional_snapshot()`);
  const snapshots = createDocumentSnapshots(f.db);
  await snapshots.capture(f.projectAId);
  const rows = await snapshots.list(f.projectAId);
  expect(rows.map((row) => row.hours)).toEqual([12]);
  expect((await f.storage.records.read("note")).value).toBe("Saved");
});
