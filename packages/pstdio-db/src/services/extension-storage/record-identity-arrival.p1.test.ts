import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { storageOwnerKey } from "./storage-owner-key";

test("an open collection sees identities allocated after its first empty query", async () => {
  const f = await createExtensionStorageFixture();
  const service = createDocumentStorageDBService(f.db);
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.arrival" };
    const records = service.open({ owner }).records;
    const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: {
          id: { path: ["id"], type: "string" },
          shorthand: { path: ["shorthand"], type: "string" },
          aliases: { path: ["aliases"], type: "array" },
        },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand", aliasesField: "aliases" },
      },
    ]);
    expect((await records.query({ index: "things", limit: 10 })).records).toEqual([]);
    for (const [id, value] of [
      ["a", 1],
      ["b", 2],
    ] as const) {
      await core.commit({
        operationId: `allocate-${id}`,
        edits: [
          {
            recordId: id,
            replace: {
              id,
              extensionId: owner.extensionId,
              kind: "thing",
              prefix: "T",
              value,
              aliases: [],
            },
          },
        ],
      });
      await records.commit({ operationId: `create-${id}`, edits: [{ recordId: id, replace: { id } }] });
      const page = await records.query({ index: "things", where: { field: "id", op: "eq", value: id }, limit: 1 });
      expect(page.records.map(({ fields }) => fields)).toEqual([
        { id, shorthand: `T-${value}`, aliases: [`T-${value}`] },
      ]);
      expect((await records.aggregate({ index: "things" })).count).toBe(value);
    }
    await core.commit({
      operationId: "renumber",
      edits: [{ recordId: "a", set: { "/value": 3, "/aliases": ["T-1"] } }],
    });
    expect(
      (await records.query({ index: "things", where: { field: "shorthand", op: "eq", value: "T-3" }, limit: 1 }))
        .records[0]?.fields.aliases,
    ).toEqual(["T-1", "T-3"]);
  } finally {
    await service.flushStatistics();
    await f.close();
  }
});

test("upgrading repairs identities that arrived after the old query-metadata marker", async () => {
  const f = await createExtensionStorageFixture();
  const service = createDocumentStorageDBService(f.db);
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.upgrade" };
    const records = service.open({ owner }).records;
    const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["shorthand"], type: "string" } },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
      },
    ]);
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
    await records.commit({ operationId: "create", edits: [{ recordId: "a", replace: { id: "a" } }] });
    expect((await records.query({ index: "things", limit: 1 })).records).toHaveLength(1);
    // Reconstruct the prior runtime's completed backfill followed by an unprojected new identity.
    const previousMarker = '@pstdio/query-format/["@core-identities","v1","0"]';
    const currentMarker = '@pstdio/query-format/["@core-identities","v2","0"]';
    await f.db.execute(sql`UPDATE owners SET record_indexes = (record_indexes - ${currentMarker}) ||
      jsonb_build_object(${previousMarker}::text, record_indexes->${currentMarker})
      WHERE id = ${storageOwnerKey({ ...owner, extensionId: "pstdio" })}`);
    await f.db.execute(sql`UPDATE storage_current_records SET query_values = '{}'::jsonb
      WHERE owner_id = ${storageOwnerKey({ ...owner, extensionId: "pstdio" })} AND record_id = 'a'`);
    expect((await records.query({ index: "things", limit: 1 })).records[0]?.fields.shorthand).toBe("T-1");
  } finally {
    await service.flushStatistics();
    await f.close();
  }
});

test("pre-repair identity cursors restart instead of skipping newly eligible earlier records", async () => {
  const f = await createExtensionStorageFixture();
  const service = createDocumentStorageDBService(f.db);
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "example.cursor-upgrade" };
    const records = service.open({ owner }).records;
    const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["shorthand"], type: "string" } },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
      },
    ]);
    for (const [value, id] of ["a", "c", "d"].entries()) {
      await core.commit({
        operationId: `allocate-${id}`,
        edits: [
          {
            recordId: id,
            replace: {
              id,
              extensionId: owner.extensionId,
              kind: "thing",
              prefix: "T",
              value: value + 1,
              aliases: [],
            },
          },
        ],
      });
      await records.commit({ operationId: `create-${id}`, edits: [{ recordId: id, replace: { id } }] });
    }
    const first = await records.query({ index: "things", limit: 1 });
    // Historical v1 cursors used owner/index/core revisions, without a query-metadata generation.
    // An old page saw C first because A's newly allocated identity had no query metadata yet.
    const legacy = JSON.parse(Buffer.from(first.cursor!, "base64").toString("utf8"));
    legacy.revision = first.revision.split(":").slice(0, 3).join(":");
    legacy.recordId = "c";
    const cursor = Buffer.from(JSON.stringify(legacy)).toString("base64");
    await expect(records.query({ index: "things", limit: 1, cursor })).rejects.toThrow("stale");
    await expect(records.query({ index: "things", limit: 1, revision: legacy.revision })).rejects.toThrow("stale");
    expect(first.records[0]?.recordId).toBe("a");
    expect((await records.query({ index: "things", limit: 1, cursor: first.cursor! })).records[0]?.recordId).toBe("c");
  } finally {
    await service.flushStatistics();
    await f.close();
  }
});
