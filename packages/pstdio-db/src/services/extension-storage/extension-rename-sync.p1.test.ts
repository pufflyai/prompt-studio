import { afterEach, expect, test } from "bun:test";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { extensionTransportName } from "pstdio-api-contracts/extension-host";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import { createDocumentSync, createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import * as s from "../../db/schemas.pg";
import { migrateExtensionIdentities } from "../extension-identity-migration";
import { createDocumentStorageDBService } from "./document-storage";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const current = "pstdio.notes";
const historical = "pstdio.pstdio-notes";
// Capture real authored state before migration, in FK order, rather than fabricating wire envelopes.
const tables: PgTable[] = [
  s.storage_documents,
  s.storage_record_projections,
  s.storage_ordered_owners,
  s.storage_ordered_operations,
  s.storage_record_sync,
  s.storage_log_streams,
  s.native_document_sources,
  s.storage_document_updates,
  s.storage_document_operations,
  s.storage_current_records,
  s.storage_record_indexes,
  s.storage_ordered_records,
  s.storage_ordered_touches,
  s.storage_ordered_receipts,
  s.storage_record_outbox,
  s.storage_log_entries,
  s.native_document_file_projections,
  s.native_document_rooms,
];

test("two upgraded devices, an offline return and a clean join share encrypted streams without rewriting queued history", async () => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: current };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const relays = new Map<string, ReturnType<typeof createRelay>>();
  const relayFor = (name: string) => {
    const relay = relays.get(name) ?? createRelay();
    relays.set(name, relay);
    return relay.relay;
  };
  const database = async () => {
    const connection = await createDb({ path: ":memory:" });
    cleanup.push(connection.close);
    const now = new Date().toISOString();
    await connection.db
      .insert(s.projects)
      .values({ id: projectId, name: "Upgrade", shorthand: "U", created_at: now, updated_at: now });
    return connection.db;
  };
  const connect = (db: Awaited<ReturnType<typeof database>>) => {
    const service = createDocumentStorageDBService(db);
    const records = service.open({ owner, textFields: [{ prefix: "note:", fields: ["/body"] }] }).records;
    const failures: unknown[] = [];
    const name = (...parts: string[]) => extensionTransportName(owner.extensionId, ...parts);
    const start = async () => {
      const streamName = name("record-stream-v2");
      const stream = createRecordStreamSync({
        space,
        documentId: await space.documentId(streamName),
        relay: relayFor(streamName),
        store: service.documents.recordStream(owner),
        quarantine: async (error) => {
          failures.push(error);
        },
      });
      const syncDocument = async (id: string) => {
        const transport = name(id === "records" ? "owner" : id);
        await createDocumentSync({
          owner,
          space,
          documentId: await space.documentId(transport),
          relay: relayFor(transport),
          store: service.documents.open(id),
          quarantine: async (error) => {
            failures.push(error);
          },
        }).synchronize();
      };
      await syncDocument("records");
      await stream.synchronize();
      for (const id of await service.documents.list(owner)) if (id !== "records") await syncDocument(id);
      await service.logs.publish(owner);
    };
    service.logs.attach(owner, async (entry, store) => {
      const transport = name("append-log-v1", entry.name, entry.scope, entry.stream);
      return createLogStreamSync({
        space,
        documentId: await space.documentId(transport),
        relay: relayFor(transport),
        store,
      });
    });
    return {
      db,
      service,
      records,
      synchronize: start,
      failures,
      text: service.openTextDocument({ owner, fileId: "draft" }),
      native: service.openNativeTextDocument({ owner, fileId: "a".repeat(64) }),
      log: service.logs.open(owner, { name: "history" }, "project"),
    };
  };
  const seed = connect(await database());
  await seed.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note:stable", replace: { body: "Retained", title: "Original" } }],
  });
  await seed.records.bindText({ recordId: "note:stable", field: "/body", documentKey: "a".repeat(64) });
  await seed.text.save("Draft before upgrade");
  await seed.log.append("Original log", { id: "log-stable" });
  await seed.synchronize();
  await seed.records.commit({
    operationId: "offline-save",
    edits: [{ recordId: "note:offline", replace: { title: "Offline" } }],
  });
  const snapshot = await Promise.all(
    tables.map(async (table) => ({
      table,
      rows: await seed.db
        .select()
        .from(table)
        .where(eq(getTableColumns(table).extension_id!, current)),
    })),
  );
  const upgraded = async () => {
    const db = await database();
    for (const { table, rows } of snapshot)
      if (rows.length) await db.insert(table).values(rows.map((row) => ({ ...row, extension_id: historical })));
    const before = await db.select().from(s.storage_ordered_operations);
    await migrateExtensionIdentities(db);
    const after = await db.select().from(s.storage_ordered_operations);
    expect(after.map(({ extension_id: _, ...row }) => row)).toEqual(before.map(({ extension_id: _, ...row }) => row));
    await migrateExtensionIdentities(db);
    return connect(db);
  };
  const first = await upgraded();
  const second = await upgraded();
  const returning = await upgraded();
  await first.synchronize();
  await second.synchronize();
  await first.records.commit({
    operationId: "after-upgrade",
    edits: [{ recordId: "note:new", replace: { title: "New" } }],
  });
  await first.synchronize();
  await second.synchronize();
  await returning.records.commit({
    operationId: "returning-offline",
    edits: [{ recordId: "note:returning", replace: { title: "Returning" } }],
  });
  await returning.synchronize();
  await first.synchronize();
  await second.synchronize();
  const joined = connect(await database());
  await joined.synchronize();
  for (const device of [first, second, returning, joined]) {
    expect(device.failures).toEqual([]);
    expect((await device.records.read("note:stable")).value).toMatchObject({ title: "Original" });
    expect((await device.records.read("note:offline")).value).toEqual({ title: "Offline" });
    expect((await device.records.read("note:new")).value).toEqual({ title: "New" });
    expect((await device.records.read("note:returning")).value).toEqual({ title: "Returning" });
    expect(await device.native.read()).toBe("Retained");
    expect(await device.text.read()).toBe("Draft before upgrade");
    expect((await device.log.read({ after: 0, limit: 10 })).entries.map((e) => e.id)).toEqual(["log-stable"]);
    expect(
      await device.db.select().from(s.storage_documents).where(eq(s.storage_documents.extension_id, historical)),
    ).toEqual([]);
  }
  expect([...relays.keys()].every((key) => JSON.parse(key)[0] === historical)).toBe(true);
  expect([...relays.keys()]).toContain(JSON.stringify([historical, "owner"]));
  expect([...relays.keys()]).toContain(JSON.stringify([historical, "record-stream-v2"]));
  expect([...relays.keys()].some((key) => JSON.parse(key)[1] === "append-log-v1")).toBe(true);
});
