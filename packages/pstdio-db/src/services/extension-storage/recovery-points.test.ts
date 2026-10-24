import { afterEach, expect, test } from "bun:test";
import type { StorageObserver } from "pstdio-sync";
import { createDb } from "../../db/connection.pglite";
import { projects, recovery_point_owners, recovery_points } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createExtensionUserDataDBService } from "../extension-user-data/extension-user-data";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionStorageDBService } from "./extension-storage";
import { RecoveryPointError } from "./recovery-points";

const hour = 3_600_000;
const start = new Date("2026-10-24T08:00:00Z");
const later = (hours: number) => new Date(start.getTime() + hours * hour);
let close: (() => Promise<void>) | undefined;

afterEach(async () => {
  await close?.();
  close = undefined;
});

const setup = async (options: { free?: number; observer?: StorageObserver } = {}) => {
  const connection = await createDb({ path: ":memory:" });
  close = connection.close;
  const { db } = connection;
  let free = options.free ?? Number.MAX_SAFE_INTEGER;
  const svc = createExtensionStorageDBService(db, options.observer, { freeBytes: async () => free });
  const projectId = crypto.randomUUID();
  const timestamp = start.toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "P", shorthand: "P", created_at: timestamp, updated_at: timestamp });
  const instances: Record<string, string> = {};
  for (const extensionId of ["ext.tickets", "ext.notes"]) {
    const source = await createInstalledExtensionSourcesDBService(db).register({
      install_name: extensionId,
      extension_id: extensionId,
      display_name: extensionId,
      source_kind: "local_path",
      source_path: `/builtin/${extensionId}`,
    });
    const instance = await createExtensionInstancesDBService(db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: projectId,
    });
    instances[extensionId] = instance.id;
  }
  const records = async (extensionId: string) =>
    (await svc.open({ owner: { workbenchId: projectId, extensionId } })).records;
  return {
    db,
    svc,
    projectId,
    instances,
    records,
    setFree: (value: number) => {
      free = value;
    },
  };
};

test("restoring a project brings back a deleted record through a normal record commit", async () => {
  const committed: string[] = [];
  const observer: StorageObserver = {
    read: () => {},
    group: (_owner, group) => group,
    committed: (_owner, records) => committed.push(...records.map((record) => record.recordId)),
  };
  const { svc, projectId, records } = await setup({ observer });
  const tickets = await records("ext.tickets");
  await tickets.commit({ operationId: "create", edits: [{ recordId: "PS-1", replace: { title: "Saved" } }] });
  await svc.recovery.capture(projectId, start);
  const [point] = await svc.recovery.list(projectId);
  await tickets.commit({ operationId: "delete", edits: [{ recordId: "PS-1", deleted: true }] });
  const watched: string[] = [];
  svc.watch((owner) => watched.push(owner.extensionId));
  committed.length = 0;

  expect(await svc.recovery.restore(projectId, { hours: point!.hours, capturedAt: point!.capturedAt })).toEqual({
    extensions: ["ext.tickets"],
    records: 1,
  });

  expect((await tickets.read("PS-1")).value).toEqual({ title: "Saved" });
  expect(committed).toContain("PS-1");
  expect(watched).toContain("ext.tickets");
});

test("restoring one extension leaves other extensions unchanged", async () => {
  const { svc, projectId, records } = await setup();
  const tickets = await records("ext.tickets");
  const notes = await records("ext.notes");
  await tickets.commit({ operationId: "t1", edits: [{ recordId: "ticket", replace: "before" }] });
  await notes.commit({ operationId: "n1", edits: [{ recordId: "note", replace: "before" }] });
  await svc.recovery.capture(projectId, start);
  const [point] = await svc.recovery.list(projectId);
  expect(point!.extensions).toEqual(["ext.notes", "ext.tickets"]);
  await tickets.commit({ operationId: "t2", edits: [{ recordId: "ticket", replace: "after" }] });
  await notes.commit({ operationId: "n2", edits: [{ recordId: "note", replace: "after" }] });
  await notes.commit({ operationId: "n3", edits: [{ recordId: "added", replace: "after" }] });

  await svc.recovery.restore(projectId, { ...point!, extensionId: "ext.notes" });

  expect((await notes.read("note")).value).toBe("before");
  expect((await notes.read("added")).deleted).toBe(true);
  expect((await tickets.read("ticket")).value).toBe("after");
});

test("a project keeps at most one hour, 12-hour and day point with their capture times", async () => {
  const { svc, projectId, records } = await setup();
  const tickets = await records("ext.tickets");
  await tickets.commit({ operationId: "seed", edits: [{ recordId: "ticket", replace: 1 }] });
  await svc.recovery.capture(projectId, start);
  await tickets.commit({ operationId: "edit", edits: [{ recordId: "ticket", replace: 2 }] });
  await svc.recovery.capture(projectId, later(1));
  await svc.recovery.capture(projectId, later(12));

  expect((await svc.recovery.list(projectId)).map(({ hours, capturedAt }) => ({ hours, capturedAt }))).toEqual([
    { hours: 1, capturedAt: later(12).toISOString() },
    { hours: 12, capturedAt: later(12).toISOString() },
    { hours: 24, capturedAt: start.toISOString() },
  ]);
});

test("when free space cannot hold three points, only the 12-hour point is kept", async () => {
  const { svc, projectId, records, setFree } = await setup();
  const tickets = await records("ext.tickets");
  await tickets.commit({ operationId: "seed", edits: [{ recordId: "ticket", replace: "x".repeat(1_000) }] });
  await svc.recovery.capture(projectId, start);
  expect(await svc.recovery.list(projectId)).toHaveLength(3);
  setFree(1);

  await svc.recovery.capture(projectId, later(24));

  expect((await svc.recovery.list(projectId)).map((point) => point.hours)).toEqual([12]);
  setFree(Number.MAX_SAFE_INTEGER);
  await svc.recovery.capture(projectId, later(25));
  expect((await svc.recovery.list(projectId)).map((point) => point.hours)).toEqual([1, 12, 24]);
});

test("a restore keeps the replaced state in the hour point so it can be undone", async () => {
  const { svc, projectId, records } = await setup();
  const tickets = await records("ext.tickets");
  await tickets.commit({ operationId: "seed", edits: [{ recordId: "ticket", replace: "before" }] });
  await svc.recovery.capture(projectId, start);
  const day = (await svc.recovery.list(projectId)).find((point) => point.hours === 24)!;
  await tickets.commit({ operationId: "edit", edits: [{ recordId: "ticket", replace: "after" }] });

  await svc.recovery.restore(projectId, day);
  expect((await tickets.read("ticket")).value).toBe("before");
  const undo = (await svc.recovery.list(projectId)).find((point) => point.hours === 1)!;
  await svc.recovery.restore(projectId, undo);

  expect((await tickets.read("ticket")).value).toBe("after");
  expect(await svc.recovery.list(projectId)).toHaveLength(3);
});

test("a restore rejects a changed recovery point and an unknown extension", async () => {
  const { svc, projectId, records } = await setup();
  await (await records("ext.tickets")).commit({ operationId: "seed", edits: [{ recordId: "t", replace: 1 }] });
  await svc.recovery.capture(projectId, start);
  const [point] = await svc.recovery.list(projectId);
  await svc.recovery.capture(projectId, later(2));

  await expect(svc.recovery.restore(projectId, point!)).rejects.toBeInstanceOf(RecoveryPointError);
  const [fresh] = await svc.recovery.list(projectId);
  await expect(svc.recovery.restore(projectId, { ...fresh!, extensionId: "ext.missing" })).rejects.toBeInstanceOf(
    RecoveryPointError,
  );
});

test("a restore brings back text documents and data migration markers", async () => {
  const { svc, projectId, records } = await setup();
  const owner = { workbenchId: projectId, extensionId: "ext.notes" };
  await (await records("ext.notes")).commit({ operationId: "seed", edits: [{ recordId: "n", replace: 1 }] });
  const text = svc.openTextDocument({ owner, fileId: "readme" });
  await text.save("Saved text");
  const storage = await svc.open({ owner });
  await storage.setDataVersion("notes", 1);
  await svc.recovery.capture(projectId, start);
  await text.save("Overwritten");
  await storage.setDataVersion("notes", 2);

  await svc.recovery.restore(projectId, (await svc.recovery.list(projectId))[0]!);

  expect(await text.read()).toBe("Saved text");
  expect(await storage.dataVersion("notes")).toBe(1);
});

test("removing an extension's data also removes it from recovery points", async () => {
  const { db, svc, projectId, records, instances } = await setup();
  await (await records("ext.notes")).commit({ operationId: "n", edits: [{ recordId: "n", replace: 1 }] });
  await (await records("ext.tickets")).commit({ operationId: "t", edits: [{ recordId: "t", replace: 1 }] });
  await svc.recovery.capture(projectId, start);

  await createExtensionUserDataDBService(db).deleteForInstance(instances["ext.notes"]!);

  const owners = await db.select({ id: recovery_point_owners.extension_id }).from(recovery_point_owners);
  expect(new Set(owners.map((owner) => owner.id))).toEqual(new Set(["ext.tickets"]));
  expect(await db.select().from(recovery_points)).toHaveLength(3);
});

test("a project without saved data gets no recovery point", async () => {
  const { svc, projectId } = await setup();
  await svc.recovery.capture(projectId, start);
  expect(await svc.recovery.list(projectId)).toEqual([]);
});

test("a restored record gets back its shared text exactly once", async () => {
  const { svc, projectId, records } = await setup();
  const notes = await records("ext.notes");
  await notes.commit({
    operationId: "write",
    edits: [{ recordId: "doc", replace: "meta", shared: [{ kind: "text.insert", index: 0, text: "Saved body" }] }],
  });
  await svc.recovery.capture(projectId, start);
  await notes.commit({
    operationId: "edit",
    edits: [{ recordId: "doc", shared: [{ kind: "text.insert", index: 10, text: " and more" }] }],
  });
  await notes.commit({ operationId: "delete", edits: [{ recordId: "doc", deleted: true }] });

  await svc.recovery.restore(projectId, (await svc.recovery.list(projectId))[0]!);

  expect(await notes.read("doc")).toMatchObject({
    deleted: false,
    value: "meta",
    shared: { kind: "text", value: "Saved body" },
  });
});

test("a capture that runs during a restore records the finished restore", async () => {
  const { svc, projectId, records } = await setup();
  const tickets = await records("ext.tickets");
  const edits = (value: string) =>
    Array.from({ length: 300 }, (_, index) => ({ recordId: `t${index}`, replace: value }));
  await tickets.commit({ operationId: "seed", edits: edits("before") });
  await svc.recovery.capture(projectId, start);
  const day = (await svc.recovery.list(projectId)).find((point) => point.hours === 24)!;
  await tickets.commit({ operationId: "edit", edits: edits("after") });

  const restoring = svc.recovery.restore(projectId, day);
  await svc.recovery.capture(projectId, later(13));
  await restoring;

  const twelve = (await svc.recovery.list(projectId)).find((point) => point.hours === 12)!;
  await tickets.commit({ operationId: "again", edits: edits("later") });
  await svc.recovery.restore(projectId, twelve);
  expect(new Set((await tickets.list()).map((record) => record.value))).toEqual(new Set(["before"]));
});

test("a restore stops before any change when a saved file is missing", async () => {
  const { svc, projectId, records } = await setup();
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "image/png" };
  const present = { verifyComplete: async () => {}, read: async () => new ReadableStream(), receive: async () => {} };
  const tickets = (await svc.open({ owner: { workbenchId: projectId, extensionId: "ext.tickets" }, assets: present }))
    .records;
  await tickets.commit({ operationId: "seed", edits: [{ recordId: "image", replace: "x", asset }] });
  await svc.recovery.capture(projectId, start);
  const before = await svc.recovery.list(projectId);
  await (await records("ext.tickets")).commit({ operationId: "delete", edits: [{ recordId: "image", deleted: true }] });
  const missing = {
    ...present,
    verifyComplete: async () => {
      throw new Error("missing");
    },
  };

  await expect(svc.recovery.restore(projectId, before[0]!, () => missing)).rejects.toBeInstanceOf(RecoveryPointError);

  expect((await tickets.read("image")).deleted).toBe(true);
  expect(await svc.recovery.list(projectId)).toEqual(before);
});

test("a restore that changes nothing keeps every recovery point", async () => {
  const { svc, projectId, records } = await setup();
  await (await records("ext.tickets")).commit({ operationId: "seed", edits: [{ recordId: "t", replace: 1 }] });
  await svc.recovery.capture(projectId, start);
  const before = await svc.recovery.list(projectId);

  expect(await svc.recovery.restore(projectId, before[2]!)).toEqual({ extensions: [], records: 0 });

  expect(await svc.recovery.list(projectId)).toEqual(before);
});

// Starts deleting the extension's data right after the restore's first batch commits.
const deleteWhileRestoring = async () => {
  let removing: Promise<unknown> | undefined;
  let restoring = false;
  let remove = () => Promise.resolve<unknown>(undefined);
  const observer: StorageObserver = {
    read: () => {},
    group: (_owner, group) => group,
    committed: () => {
      if (!restoring || removing) return;
      removing = remove();
    },
  };
  const { db, svc, projectId, instances, records } = await setup({ observer });
  const userData = createExtensionUserDataDBService(db);
  const deleteData = () => userData.deleteForInstance(instances["ext.tickets"]!);
  remove = () => svc.recovery.exclusive(projectId, deleteData);
  const tickets = await records("ext.tickets");
  const edits = Array.from({ length: 250 }, (_, index) => ({ recordId: `T-${index}`, replace: index }));
  await tickets.commit({ operationId: "create", edits });
  await svc.recovery.capture(projectId, start);
  const [point] = await svc.recovery.list(projectId);
  await tickets.commit({ operationId: "delete", edits: edits.map(({ recordId }) => ({ recordId, deleted: true })) });
  restoring = true;
  await svc.recovery.restore(projectId, { hours: point!.hours, capturedAt: point!.capturedAt });
  await removing;
  return (await tickets.list()).filter((record) => !record.deleted).length;
};

test("deleting an extension's data during a restore keeps it deleted", async () => {
  expect(await deleteWhileRestoring()).toBe(0);
});

test("restoring records that together are over one commit's size limit splits the restore", async () => {
  const { svc, projectId, records } = await setup();
  const tickets = await records("ext.tickets");
  const body = "x".repeat(220 * 1024);
  const ids = Array.from({ length: 20 }, (_, index) => `PS-${index}`);
  // Each save stays within the limits; the restore writes all of them back.
  for (const id of ids) await tickets.commit({ operationId: `create-${id}`, edits: [{ recordId: id, replace: body }] });
  await svc.recovery.capture(projectId, start);
  const [point] = await svc.recovery.list(projectId);
  for (const id of ids) await tickets.commit({ operationId: `delete-${id}`, edits: [{ recordId: id, deleted: true }] });

  await svc.recovery.restore(projectId, { hours: point!.hours, capturedAt: point!.capturedAt });

  for (const id of ids) expect((await tickets.read(id)).value).toBe(body);
});
