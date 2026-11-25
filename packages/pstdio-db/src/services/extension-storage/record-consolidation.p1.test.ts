import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { OrderedRecord } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { owners, projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOrderedJournal, withOrderedOwner } from "./ordered-journal";
import { publishOrderedProjection } from "./ordered-projection";
import { prepareOrderedAdmission, rebaseOrderedProjection } from "./ordered-rebase";
import { withOrderedRecordSavepoint } from "./ordered-record-publication";

test("one record row releases its confirmed base after local settlement and preserves deleted restore content", async () => {
  const connection = await createDb({ path: ":memory:" });
  const service = createDocumentStorageDBService(connection.db);
  try {
    const now = new Date().toISOString(),
      id = crypto.randomUUID();
    await connection.db
      .insert(projects)
      .values({ id, name: "Records", shorthand: "R", created_at: now, updated_at: now });
    const owner = { workbenchId: id, extensionId: "example.records" },
      records = service.open({ owner }).records;
    await records.commit({ operationId: "create", edits: [{ recordId: "card", replace: { title: "restore me" } }] });
    const { rows: catalog } = await connection.db.execute<{ name: string }>(
      sql`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename IN ('records','storage_ordered_records','storage_current_records') ORDER BY name`,
    );
    expect(catalog.map((row) => row.name)).toEqual(["records"]);
    const stored = () =>
      connection.db.execute<{ base: Uint8Array | null; meta: unknown }>(
        sql`SELECT base,meta FROM records WHERE record_id='card'`,
      );
    expect((await stored()).rows).toMatchObject([{ base: null }]);
    await records.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
    expect((await records.readMany(["card"]))[0]).toMatchObject({ deleted: true, value: null });
    expect((await stored()).rows).toMatchObject([{ base: null }]);
    await records.commit({ operationId: "restore", edits: [{ recordId: "card", deleted: false }] });
    expect((await records.readMany(["card"]))[0]).toMatchObject({ deleted: false, value: { title: "restore me" } });
    expect((await stored()).rows).toMatchObject([{ base: null }]);
    await expect(
      withOrderedOwner(connection.db, owner, async (journal) => {
        const before = (await journal.canonical(["card"])).get("card")!;
        await journal.saveCanonical([{ ...before, value: { value: { title: "unpublished" } } }]);
      }),
    ).rejects.toThrow("publication");
    expect((await records.readMany(["card"]))[0]).toMatchObject({ value: { title: "restore me" } });
  } finally {
    await service.flushStatistics();
    await connection.close();
  }
});

test("overlapping pending saves keep one confirmed base and refused creations leave no canonical row", async () => {
  const connection = await createDb({ path: ":memory:" }),
    service = createDocumentStorageDBService(connection.db);
  try {
    const now = new Date().toISOString(),
      id = crypto.randomUUID();
    await connection.db
      .insert(projects)
      .values({ id, name: "Pending", shorthand: "P", created_at: now, updated_at: now });
    const owner = { workbenchId: id, extensionId: "example.pending" },
      records = service.open({ owner }).records;
    await records.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "confirmed" } }] });
    await connection.db.update(owners).set({ joined: true, epoch: "cloud" }).where(eq(owners.project_id, id));
    await records.commit({
      operationId: "pending-one",
      edits: [
        { recordId: "card", replace: { title: "first" } },
        { recordId: "new", replace: { title: "creation" } },
      ],
    });
    await records.commit({ operationId: "pending-two", edits: [{ recordId: "card", replace: { title: "second" } }] });
    await records.commit({
      operationId: "pending-shared",
      edits: ["card", "new"].map((recordId) => ({
        recordId,
        shared: [{ kind: "map.set", key: "marker", value: "pending" }],
      })),
    });
    expect(await records.read("card")).toMatchObject({ shared: { kind: "map", value: { marker: "pending" } } });
    expect(await records.read("new")).toMatchObject({ shared: { kind: "map", value: { marker: "pending" } } });
    const rows = (
      await connection.db.execute<{ record_id: string; base: Uint8Array }>(
        sql`SELECT record_id,base FROM records ORDER BY record_id`,
      )
    ).rows;
    expect(JSON.parse(Buffer.from(rows[0]!.base).toString())).toMatchObject({
      value: { value: { title: "confirmed" } },
    });
    expect(JSON.parse(Buffer.from(rows[1]!.base).toString())).toBeNull();
    expect((await records.readMany(["card"]))[0]).toMatchObject({ value: { title: "second" } });
    await withOrderedOwner(connection.db, owner, async (journal, tx) => {
      for (const { operation } of await journal.pending()) {
        const admission = await prepareOrderedAdmission(journal, operation, "cloud");
        await journal.recordDecision(
          { epoch: "cloud", operationId: operation.operationId, fingerprint: operation.fingerprint, state: "refused" },
          await fingerprint(admission as never),
        );
      }
      await rebaseOrderedProjection(journal, tx, owner, ["card", "new"]);
      expect((await journal.canonical(["card"])).get("card")).toMatchObject({
        value: { value: { title: "confirmed" } },
      });
    });
    expect(await records.readMany(["card", "new"])).toMatchObject([
      { value: { title: "confirmed" } },
      { exists: false },
    ]);
    expect((await connection.db.execute(sql`SELECT base FROM records`)).rows).toEqual([{ base: null }]);
  } finally {
    await service.flushStatistics();
    await connection.close();
  }
});

test("unpublished confirmed records stay out of indexed reads and become visible on first publication", async () => {
  const connection = await createDb({ path: ":memory:" }),
    service = createDocumentStorageDBService(connection.db);
  try {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id, name: "Visibility", shorthand: "V", created_at: now, updated_at: now });
    const owner = { workbenchId: id, extensionId: "example.visibility" },
      records = service.open({ owner }).records;
    await records.defineIndexes([{ name: "items", fields: { title: { path: ["title"], type: "string" } } }]);
    const hidden: OrderedRecord = {
      recordId: "hidden",
      value: { value: { title: "Hidden" } },
      deleted: false,
      lifetime: "initial",
      stamps: { "": JSON.stringify(["canonical", "local", "hidden"]) },
    };
    await withOrderedOwner(connection.db, owner, async (journal) => journal.saveCanonical([hidden]));
    expect(await records.read("hidden")).toMatchObject({ exists: false });
    expect((await records.query({ index: "items" })).records).toEqual([]);
    expect((await records.aggregate({ index: "items" })).count).toBe(0);
    await records.commit({ operationId: "publish", edits: [{ recordId: "hidden", replace: { title: "Published" } }] });
    expect((await records.query({ index: "items" })).records.map((row) => row.recordId)).toEqual(["hidden"]);
    expect((await records.aggregate({ index: "items" })).count).toBe(1);
    await withOrderedOwner(connection.db, owner, async (journal) =>
      expect((await journal.canonical(["hidden"])).get("hidden")).toMatchObject({
        value: { value: { title: "Published" } },
      }),
    );
  } finally {
    await service.flushStatistics();
    await connection.close();
  }
});

test("savepoint release and rollback carry canonical publication obligations with their data", async () => {
  const connection = await createDb({ path: ":memory:" }),
    service = createDocumentStorageDBService(connection.db);
  try {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id, name: "Savepoints", shorthand: "S", created_at: now, updated_at: now });
    const owner = { workbenchId: id, extensionId: "example.savepoints" },
      records = service.open({ owner }).records;
    await records.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "Original" } }] });
    const change = async (journal: ReturnType<typeof createOrderedJournal>) => {
      const before = (await journal.canonical(["card"])).get("card")!;
      const changed = { ...before, value: { value: { title: "Changed" } } };
      await journal.saveCanonical([changed]);
      return changed;
    };
    await expect(
      withOrderedOwner(connection.db, owner, async (_, tx) => {
        await withOrderedRecordSavepoint(tx, async (nested) =>
          withOrderedRecordSavepoint(nested, async (child) => change(createOrderedJournal(child, owner))),
        );
      }),
    ).rejects.toThrow("publication");
    expect(await records.read("card")).toMatchObject({ value: { title: "Original" } });
    await expect(
      withOrderedOwner(connection.db, owner, async (journal, tx) => {
        const changed = await change(journal);
        await expect(
          withOrderedRecordSavepoint(tx, async (nested) => {
            await publishOrderedProjection(nested, owner, [changed]);
            throw new Error("rollback publication");
          }),
        ).rejects.toThrow("rollback publication");
      }),
    ).rejects.toThrow("publication");
    expect(await records.read("card")).toMatchObject({ value: { title: "Original" } });
    await withOrderedOwner(connection.db, owner, async (journal, tx) => {
      const changed = await change(journal);
      await withOrderedRecordSavepoint(tx, async (nested) => publishOrderedProjection(nested, owner, [changed]));
    });
    expect(await records.read("card")).toMatchObject({ value: { title: "Changed" } });
  } finally {
    await service.flushStatistics();
    await connection.close();
  }
});
