import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { clearOwnerDocuments } from "./clear-documents";
import { createExtensionStorageDBService } from "./extension-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("document and record state follows owner deletion without reviving a facade's cached document", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "example.documents" };
  const others = [
    { ...owner, extensionId: "example.other" },
    { ...owner, workbenchId: f.projectBId },
  ];
  const text = (svc: typeof f.svc, address: typeof owner) =>
    svc.openTextDocument({ owner: address, fileId: "same-file" });
  try {
    for (const address of [owner, ...others]) {
      const store = await f.svc.open({ owner: address });
      await store.records.commit({ operationId: "same-save", edits: [{ recordId: "same-record", replace: "Saved" }] });
      await text(f.svc, address).save("Before 🦉\u0000");
    }
    const stale = text(f.svc, owner);
    expect(await stale.read()).toBe("Before 🦉\u0000");
    const before = await f.db.execute<{ owner_id: number }>(sql`SELECT owner_id FROM storage_documents
      WHERE document_id='["text-file","same-file"]' AND owner_id=(SELECT id FROM owners
        WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId})`);
    expect(before.rows[0]!.owner_id).toBeNumber();
    await f.db.execute(
      sql`DELETE FROM owners WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`,
    );
    const fresh = createExtensionStorageDBService(f.db);
    await text(fresh, owner).save("After");
    // The old and new documents both have revision one; only the physical owner differs.
    expect(await stale.read()).toBe("After");
    const after = await f.db.execute<{ owner_id: number }>(sql`SELECT owner_id FROM storage_documents
      WHERE document_id='["text-file","same-file"]' AND owner_id=(SELECT id FROM owners
        WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId})`);
    expect(after.rows[0]!.owner_id).not.toBe(before.rows[0]!.owner_id);
    const empty = await fresh.open({ owner });
    expect((await empty.records.read("same-record")).exists).toBe(false);
    for (const address of others) {
      expect(await text(f.svc, address).read()).toBe("Before 🦉\u0000");
      expect((await (await f.svc.open({ owner: address })).records.read("same-record")).value).toBe("Saved");
    }
  } finally {
    await f.close();
  }
});

test("identity counts follow a recreated core owner before indexes are reinstalled", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "example.identity-generation" };
  const coreOwner = { ...owner, extensionId: "pstdio" };
  try {
    const records = (await f.svc.open({ owner })).records;
    const definition = {
      name: "things",
      fields: {
        id: { path: ["id"], type: "string" as const },
        state: { path: ["state"], type: "string" as const, derive: { kind: "string" as const } },
        shorthand: { path: ["shorthand"], type: "string" as const },
      },
      identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
      countBy: ["state"],
    };
    await records.defineIndexes([definition]);
    await records.commit({ operationId: "create", edits: [{ recordId: "a", replace: { id: "a", state: "open" } }] });
    const allocate = async (svc: typeof f.svc) => {
      const core = (await svc.open({ owner: coreOwner })).records;
      await core.commit({
        operationId: "allocate",
        edits: [
          {
            recordId: "a",
            replace: {
              id: "a",
              extensionId: owner.extensionId,
              kind: "thing",
              prefix: "T",
              value: 1,
              aliases: [],
            },
          },
        ],
      });
    };
    await allocate(f.svc);
    const query = { index: "things", groupBy: "state" };
    expect((await records.aggregate(query)).count).toBe(1);
    await f.db.execute(sql`DELETE FROM owners WHERE project_id=${coreOwner.workbenchId} AND extension_id='pstdio'`);
    expect((await records.aggregate(query)).count).toBe(0);
    await allocate(createExtensionStorageDBService(f.db));
    expect((await records.aggregate(query)).count).toBe(1);
    expect((await records.query({ index: "things", limit: 10 })).records).toHaveLength(1);
    await records.defineIndexes([definition]);
    expect((await records.aggregate(query)).count).toBe(1);
  } finally {
    await f.close();
  }
});

test("purging an owner removes its generated query objects before deleting their declarations", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "example.purge-catalog" };
  try {
    const records = (await f.svc.open({ owner })).records;
    const index = {
      name: "states",
      fields: { state: { path: ["state"], type: "string" as const, derive: { kind: "string" as const } } },
      equality: ["state"],
      countBy: ["state"],
    };
    await records.defineIndexes([index]);
    await records.commit({ operationId: "seed", edits: [{ recordId: "one", replace: { state: "open" } }] });
    const {
      rows: [saved],
    } = await f.db.execute<{ name: string }>(
      sql`SELECT record_indexes->'states'->>'database_name' AS name FROM owners WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId}`,
    );
    await f.db.transaction((tx) => clearOwnerDocuments(tx, owner));
    const objects = await f.db.execute(
      sql`SELECT relname AS name FROM pg_class WHERE starts_with(relname,${saved!.name}) UNION ALL SELECT proname FROM pg_proc WHERE starts_with(proname,${saved!.name})`,
    );
    expect(objects.rows).toEqual([]);
    const fresh = (await createExtensionStorageDBService(f.db).open({ owner })).records;
    await fresh.defineIndexes([index]);
    await fresh.commit({ operationId: "seed", edits: [{ recordId: "one", replace: { state: "new" } }] });
    expect((await fresh.aggregate({ index: index.name, groupBy: "state" })).groups).toEqual([
      { value: "new", count: 1 },
    ]);
  } finally {
    await f.close();
  }
});

test("identity-order cursors reject a recreated core owner at the same revision", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "example.cursor-generation" };
  const coreOwner = { ...owner, extensionId: "pstdio" };
  try {
    const records = (await f.svc.open({ owner })).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["shorthand"], type: "string" } },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
        orderBy: [{ field: "shorthand", direction: "asc" }],
      },
    ]);
    await records.commit({
      operationId: "create",
      edits: ["one", "two"].map((id) => ({ recordId: id, replace: { id } })),
    });
    const allocate = async (svc: typeof f.svc, ids: string[]) => {
      const core = (await svc.open({ owner: coreOwner })).records;
      await core.commit({
        operationId: "allocate",
        edits: ids.map((id, i) => ({
          recordId: id,
          replace: {
            id,
            extensionId: owner.extensionId,
            kind: "thing",
            prefix: "T",
            value: i + 1,
            aliases: [],
          },
        })),
      });
    };
    await allocate(f.svc, ["one", "two"]);
    const query = { index: "things", limit: 1 };
    const first = await records.query(query);
    expect(first.records[0]?.recordId).toBe("one");
    expect(first.cursor).not.toBeNull();
    await f.db.execute(sql`DELETE FROM owners WHERE project_id=${owner.workbenchId} AND extension_id='pstdio'`);
    await allocate(createExtensionStorageDBService(f.db), ["two"]);
    const fresh = await records.query(query);
    expect(fresh.records[0]?.recordId).toBe("two");
    await expect(records.query({ ...query, cursor: first.cursor! })).rejects.toThrow(/stale/iu);
    expect(fresh.revision).not.toBe(first.revision);
  } finally {
    await f.close();
  }
});
