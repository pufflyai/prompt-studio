import { afterEach, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { blankRecord } from "pstdio-sync";
import type { Snapshot } from "pstdio-sync-contracts";
import * as schema from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";
import { openGroupedTestStorage, groupedStorageOwner as owner } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const setup = async () => {
  const database = await openGroupedTestStorage(cleanup);
  const queries: string[] = [];
  const db = drizzle(database.pglite, { schema, logger: { logQuery: (query) => queries.push(query) } });
  const service = createGroupedStorageDBService(db);
  const writer = service.open({ owner, environmentId: "writer" }).records;
  const reader = createGroupedStorageDBService(db).open({ owner, environmentId: "writer" }).records;
  const save = async (operationId: string, value: string) =>
    writer.commit({
      operationId,
      edits: [{ recordId: "note", expectedRevision: (await writer.read("note")).revision, replace: value }],
    });
  const journalReads = () => queries.filter((query) => query.includes('from "extension_storage_journal"')).length;
  return { db, service, writer, reader, save, queries, journalReads };
};
const snapshot = (epoch = "epoch", value = "accepted"): Snapshot => ({
  protocolVersion: 1,
  scope: { ...owner, accountId: "account" },
  checkpoint: { epoch, sequence: 0 },
  journalSequence: 0,
  records: { remote: { ...blankRecord("remote"), revision: 1, value } },
  receipts: {},
  conflicts: {},
  publishedRevision: value,
});

test("separate services observe committed writes and retain cached caller revisions for stale guards", async () => {
  const fixture = await setup();
  const stale = await fixture.reader.read("note");
  await fixture.save("first", "first");
  expect((await fixture.reader.read("note")).value).toBe("first");
  await fixture.reader.commit({
    operationId: "stale",
    edits: [{ recordId: "note", expectedRevision: stale.revision, replace: "alternative" }],
  });
  expect((await fixture.writer.read("note")).value).toBe("first");
  expect(await fixture.writer.conflicts()).toHaveLength(1);
  await fixture.save("fresh", "fresh");
  expect((await fixture.reader.read("note")).value).toBe("fresh");
  expect((await fixture.reader.inspect("stale")).alternatives[0].records[0].value).toBe("alternative");
});

test("acceptance and recovery-proof changes invalidate projections without new journal ordinals", async () => {
  const fixture = await setup();
  await fixture.save("local", "local");
  await fixture.service.transaction(owner, async (state) => {
    state.accepted = snapshot();
  });
  const observer = createGroupedStorageDBService(fixture.db).open({ owner, environmentId: "other" }).records;
  expect((await observer.read("note")).exists).toBe(false);
  expect((await fixture.reader.outcome("local"))?.status).toBe("pending");
  await fixture.service.transaction(owner, async (state) => {
    state.journal[0].acceptance = { fingerprint: "accepted", order: 1, checkpoint: { epoch: "epoch", sequence: 1 } };
  });
  expect((await observer.read("note")).value).toBe("local");
  expect((await fixture.reader.outcome("local"))?.status).toBe("synchronized");
  fixture.queries.length = 0;
  await fixture.service.transaction(owner, async (state) => {
    state.journal[0].recoveryProof = "proof";
  });
  fixture.queries.length = 0;
  expect((await observer.read("note")).value).toBe("local");
  expect(fixture.journalReads()).toBe(1);
});

test("snapshot content and epoch replacements rebuild even when checkpoint counters match", async () => {
  const fixture = await setup();
  await fixture.save("pending", "pending");
  await fixture.service.transaction(owner, async (state) => {
    state.accepted = snapshot();
  });
  expect((await fixture.reader.read("remote")).value).toBe("accepted");
  await fixture.service.transaction(owner, async (state) => {
    state.accepted = snapshot("epoch", "replacement");
  });
  expect((await fixture.reader.read("remote")).value).toBe("replacement");
  await fixture.service.transaction(owner, async (state) => {
    state.accepted = snapshot("restored", "restore");
  });
  expect((await fixture.reader.read("remote")).value).toBe("restore");
  expect((await fixture.reader.read("note")).value).toBe("pending");
});

test("failed transactions leave durable state and cached reads unchanged", async () => {
  const fixture = await setup();
  await fixture.save("saved", "saved");
  await fixture.reader.read("note");
  await expect(
    fixture.service.transaction(owner, async (state) => {
      state.journal[0].acceptance = { fingerprint: "rollback", order: 1, checkpoint: { epoch: "epoch", sequence: 1 } };
      state.accepted = snapshot();
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  await expect(
    fixture.service.transaction(owner, async (state) => {
      state.journal.push(state.journal[0]);
    }),
  ).rejects.toThrow();
  expect((await fixture.reader.read("note")).value).toBe("saved");
  expect((await fixture.reader.outcome("saved"))?.status).toBe("saved-locally");
  expect((await fixture.writer.read("remote")).exists).toBe(false);
});

test("deleting and recreating an owner cannot reuse its old projection", async () => {
  const fixture = await setup();
  await fixture.save("saved", "old owner");
  await fixture.reader.read("note");
  await fixture.db
    .delete(schema.extension_storage_owners)
    .where(
      and(
        eq(schema.extension_storage_owners.workbench_id, owner.workbenchId),
        eq(schema.extension_storage_owners.extension_id, owner.extensionId),
      ),
    );
  expect((await fixture.reader.read("note")).exists).toBe(false);
  await fixture.save("saved", "new owner");
  expect((await fixture.reader.read("note")).value).toBe("new owner");
});

test("evicted projections rebuild from durable data and remain separated by environment and owner", async () => {
  const fixture = await setup();
  await fixture.save("saved", "writer only");
  expect((await fixture.writer.read("note")).value).toBe("writer only");
  for (let index = 0; index < 33; index++) {
    const records = fixture.service.open({ owner, environmentId: `other-${index}` }).records;
    expect((await records.read("note")).exists).toBe(false);
  }
  fixture.queries.length = 0;
  expect((await fixture.writer.read("note")).value).toBe("writer only");
  expect(fixture.journalReads()).toBe(1);
  fixture.queries.length = 0;
  expect((await fixture.writer.read("note")).value).toBe("writer only");
  expect(fixture.journalReads()).toBe(0);
  const other = fixture.service.open({ owner: { ...owner, extensionId: "other" }, environmentId: "writer" }).records;
  expect((await other.read("note")).exists).toBe(false);
  const record = await fixture.writer.read("note");
  record.value = "changed by caller";
  expect((await fixture.writer.read("note")).value).toBe("writer only");
});

test("issued projections stay immutable and caller-owned JSON and map values cannot alter committed cache data", async () => {
  const fixture = await setup();
  const issued = await fixture.service.project(owner, "writer");
  const value = { message: "committed" };
  const mapValue = { message: "map committed" };
  await fixture.writer.commit({
    operationId: "owned-values",
    edits: [
      { recordId: "note", expectedRevision: (await fixture.writer.read("note")).revision, replace: value },
      {
        recordId: "map",
        expectedRevision: (await fixture.writer.read("map")).revision,
        shared: [{ kind: "map.set", key: "key", value: mapValue }],
      },
    ],
  });
  value.message = "changed by caller";
  mapValue.message = "map changed by caller";
  expect(issued.read("note").exists).toBe(false);
  expect((await fixture.writer.read("note")).value).toEqual({ message: "committed" });
  expect((await fixture.writer.read("map")).shared).toEqual({
    kind: "map",
    value: { key: { message: "map committed" } },
  });
  expect(await fixture.writer.read("note")).toEqual(await fixture.reader.read("note"));
  expect(await fixture.writer.read("map")).toEqual(await fixture.reader.read("map"));
});
