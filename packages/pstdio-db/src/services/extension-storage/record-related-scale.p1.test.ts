import { afterAll, beforeAll, expect, test } from "bun:test";
import { type SQL, sql } from "drizzle-orm";
import type { RecordEdit, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createFirstRecordLookups } from "./record-first-match";
import { defineRecordIndexes } from "./record-index-definition";
import { createRecordQueries } from "./record-queries";
import { readQueryOwner } from "./record-query-owner";
import { recordFieldSql, recordPageSql, recordScopeSql } from "./record-query-sql";
import { relatedRecordPredicateSql } from "./record-related-query";

let f: Awaited<ReturnType<typeof createExtensionStorageFixture>>;
let owner: { workbenchId: string; extensionId: string };
let records: ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"];
const indexes: StorageRecordIndex[] = [
  {
    name: "resources",
    prefix: "resource/",
    fields: {
      id: { path: ["id"], type: "string" },
      parent: { path: ["parent"], type: "string" },
      title: { path: ["title"], type: "string" },
      dependencies: { path: ["dependencies"], type: "array" },
      breadcrumb: { path: ["breadcrumb"], type: "string" },
      group: {
        type: "string",
        lookup: { index: "placements", on: [{ sourceField: "id", relatedField: "resourceId" }], field: "group" },
      },
      dependencyTitle: {
        type: "string",
        lookup: {
          index: "resources",
          on: [{ sourceField: "dependencies", relatedField: "id", op: "contains" }],
          field: "title",
        },
      },
    },
    equality: ["id"],
    hierarchy: {
      idField: "id",
      parentField: "parent",
      labelField: "title",
      breadcrumbField: "breadcrumb",
      separator: " / ",
    },
  },
  {
    name: "placements",
    prefix: "placement/",
    fields: { resourceId: { path: ["resourceId"], type: "string" }, group: { path: ["group"], type: "string" } },
    equality: ["resourceId"],
  },
];
const resolve = (name: string) => indexes.find((index) => index.name === name)!;
beforeAll(async () => {
  f = await createExtensionStorageFixture();
  owner = { workbenchId: f.projectAId, extensionId: "related-scale" };
  records = createDocumentStorageDBService(f.db).open({ owner }).records;
  for (let offset = 0; offset < 300; offset += 100)
    await records.commit({
      operationId: String(offset),
      edits: Array.from({ length: 100 }, (_, i): RecordEdit[] => {
        const id = String(offset + i);
        return [
          {
            recordId: `resource/${id}`,
            replace: {
              id,
              title: `Resource ${id}`,
              parent: id === "299" ? "0" : null,
              dependencies: id === "299" ? ["0"] : [],
            },
          },
          { recordId: `placement/${id}`, replace: { resourceId: id, group: id === "299" ? "release" : "draft" } },
        ];
      }).flat(),
    });
  await records.defineIndexes(indexes);
}, 30000);
afterAll(async () => {
  await f?.close();
});

type PlanOwner = Awaited<ReturnType<typeof readQueryOwner>> & {
  firstMatches: ReturnType<typeof createFirstRecordLookups>;
};
const explain = async (projection: (owner: PlanOwner) => SQL) =>
  f.db.transaction(async (tx) => {
    const queryOwner = { ...(await readQueryOwner(tx, owner)), firstMatches: createFirstRecordLookups() };
    const statement = sql`EXPLAIN (ANALYZE, FORMAT JSON) SELECT ${projection(queryOwner)} FROM records WHERE ${recordScopeSql(queryOwner, indexes[0])}`;
    await queryOwner.firstMatches.prepare(tx);
    return planNodes((await tx.execute(statement)).rows);
  });
const planNodes = (rows: unknown) => {
  const nodes: Record<string, unknown>[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const object = value as Record<string, unknown>;
    if (object["Node Type"]) nodes.push(object);
    for (const child of Object.values(object)) walk(child);
  };
  walk(rows);
  return nodes;
};
const visits = (nodes: Record<string, unknown>[]) =>
  nodes.reduce(
    (sum, node) =>
      sum + Number(node["Actual Loops"]) * (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0)),
    0,
  );

test("lookup probes prepared string keys and the shared record primary key", async () => {
  const plan = await explain((owner) => recordFieldSql(indexes[0], "group", undefined, resolve, owner));
  const targets = plan.filter((node) => node.Alias === "records_lookup");
  const probes = plan.filter((node) => node["Relation Name"] === "pstdio_query_matches");
  expect(probes.some((node) => node["Index Cond"])).toBe(true);
  expect(visits([...targets, ...probes])).toBeLessThanOrEqual(600);
  expect(targets.some((node) => node["Index Cond"])).toBe(true);
  expect((await records.aggregate({ index: "resources", groupBy: "group", groupLimit: 10 })).groups).toContainEqual({
    value: "release",
    count: 1,
  });
});

test("large relationship keys use bounded probes for every source and preserve duplicate ordering", async () => {
  await f.db.transaction(async (tx) => {
    const { ownerId } = await readQueryOwner(tx, owner);
    await tx.execute(sql`INSERT INTO records(owner_id,record_id,deleted,revision,value)
      SELECT ${ownerId}::integer, 'large/'||n, false, '1', to_jsonb(repeat('x',32768)||n) FROM generate_series(1,260) n
      UNION ALL SELECT ${ownerId}::integer, 'large/000-first', false, '1', to_jsonb(repeat('x',32768)||1)`);
    const keys = createFirstRecordLookups();
    const match = keys.firstRecordByField(
      indexes[0],
      "id",
      "target",
      sql`src.keys`,
      true,
      (alias) => sql`${sql.identifier(alias)}.value`,
      (alias) =>
        sql`${sql.identifier(alias)}.owner_id=${ownerId} AND starts_with(${sql.identifier(alias)}.record_id,'large/')`,
    )!;
    const statement = sql`SELECT n, (SELECT target.record_id FROM records target
      WHERE target.owner_id=${ownerId} AND ${match} ORDER BY target.record_id COLLATE "C" LIMIT 1) AS id
      FROM (SELECT n, jsonb_build_array(NULL, 'missing', repeat('x',32768)||n) AS keys FROM generate_series(1,40) n) src ORDER BY n`;
    await keys.prepare(tx);
    const rows = (await tx.execute(statement)).rows;
    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => (i === 0 ? "large/000-first" : `large/${i + 1}`)),
    );
    const plan = planNodes((await tx.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${statement}`)).rows);
    const probes = plan.filter((node) => node["Relation Name"] === "pstdio_query_matches");
    expect(probes.some((node) => node["Index Cond"])).toBe(true);
    expect(visits(probes)).toBeLessThanOrEqual(120);
    expect(visits(plan.filter((node) => node.Alias === "target"))).toBeLessThanOrEqual(40);
  });
});

test("dependency membership probes only referenced targets including empty source arrays", async () => {
  const plan = await explain((owner) =>
    relatedRecordPredicateSql(
      owner,
      indexes[0],
      { exists: { index: "resources", on: [{ sourceField: "dependencies", relatedField: "id", op: "contains" }] } },
      resolve,
    ),
  );
  const targets = plan.filter((node) => String(node.Alias).startsWith("related_"));
  expect(visits(targets)).toBeLessThanOrEqual(600);
  expect(
    (
      await records.query({
        index: "resources",
        where: {
          exists: { index: "resources", on: [{ sourceField: "dependencies", relatedField: "id", op: "contains" }] },
        },
        fields: ["id"],
      })
    ).records.map((record) => record.fields.id),
  ).toEqual(["299"]);
});

test("breadcrumbs skip absent parents and probe the parent key for the one child", async () => {
  const targets = (
    await explain((owner) => recordFieldSql(indexes[0], "breadcrumb", undefined, resolve, owner))
  ).filter((node) => String(node.Alias).startsWith("hierarchy_ancestor"));
  expect(visits(targets)).toBeLessThanOrEqual(1);
  expect(
    (
      await records.query({
        index: "resources",
        where: { field: "id", op: "eq", value: "299" },
        fields: ["breadcrumb"],
      })
    ).records[0].fields.breadcrumb,
  ).toBe("Resource 0 / Resource 299");
});

test("breadcrumb search walks each candidate lineage once", async () => {
  const where = { field: "breadcrumb", op: "textContains", value: "resource 0 / resource 299" } as const;
  const plan = await explain((owner) => relatedRecordPredicateSql(owner, indexes[0], where, resolve));
  const ancestryWalks = plan
    .filter((node) => node["Node Type"] === "Recursive Union")
    .reduce((sum, node) => sum + Number(node["Actual Loops"]), 0);
  expect(ancestryWalks).toBe(300);
  expect(
    (await records.query({ index: "resources", where, fields: ["id"] })).records.map((row) => row.fields.id),
  ).toEqual(["299"]);
});

test("forward array lookups probe only referenced resources instead of every target", async () => {
  const targets = (
    await explain((owner) => recordFieldSql(indexes[0], "dependencyTitle", undefined, resolve, owner))
  ).filter((node) => node.Alias === "records_lookup");
  expect(visits(targets)).toBeLessThanOrEqual(600);
  expect(
    (
      await records.query({
        index: "resources",
        where: { field: "id", op: "eq", value: "299" },
        fields: ["dependencyTitle"],
      })
    ).records[0].fields.dependencyTitle,
  ).toBe("Resource 0");
});

test("serial queries reuse scratch space inside an outer records transaction", async () => {
  const { queryIn } = createRecordQueries(f.db, owner);
  const count = sql`SELECT count(*)::int AS n FROM pg_temp.pstdio_query_matches`;
  await f.db.transaction(async (tx) => {
    for (let i = 0; i < 4; i++) {
      const page = await queryIn(tx, { index: "resources", fields: ["group"], limit: 1 });
      expect(page.records[0].fields.group).toBe("draft");
      expect((await tx.execute(count)).rows).toEqual([{ n: 300 }]);
    }
  });
  expect((await f.db.execute(count)).rows).toEqual([{ n: 0 }]);
});

test("core identity lookups probe the resource ID instead of every same-kind identity", async () => {
  const core = createDocumentStorageDBService(f.db).open({ owner: { ...owner, extensionId: "pstdio" } }).records;
  for (let offset = 0; offset < 300; offset += 100)
    await core.commit({
      operationId: `identities-${offset}`,
      edits: Array.from({ length: 100 }, (_, i) => {
        const id = String(offset + i);
        return {
          recordId: id,
          replace: {
            id,
            kind: "thing",
            prefix: "X",
            value: offset + i + 1,
            extensionId: owner.extensionId,
            aliases: [],
          },
        };
      }),
    });
  const identified: StorageRecordIndex = {
    ...indexes[0],
    identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
    fields: { ...indexes[0].fields, shorthand: { path: ["unused"], type: "string" } },
  };
  // Install identity query values through the public query path before explaining the projection.
  await records.defineIndexes([...indexes, { ...identified, name: "identified" }]);
  await records.query({ index: "identified", fields: [], limit: 1 });
  const targets = (await explain((owner) => recordFieldSql(identified, "shorthand", undefined, resolve, owner))).filter(
    (node) => node.Alias === "identity",
  );
  expect(visits(targets)).toBeLessThanOrEqual(600);
  const ordered: StorageRecordIndex = {
    ...identified,
    name: "identified-ordered",
    orderBy: [{ field: "title", direction: "asc" }],
  };
  // An extension-defined order must consider every candidate's identity before sorting.
  // A host-maintained ordering can stop after filling the page.
  for (const mode of ["query", "host-index"] as const) {
    await defineRecordIndexes(f.db, owner, [...indexes, ordered], mode);
    const plan = await f.db.execute(
      sql`EXPLAIN (ANALYZE, FORMAT JSON) ${recordPageSql(ordered, [], recordScopeSql(await readQueryOwner(f.db, owner), ordered), 1, 0, resolve, await readQueryOwner(f.db, owner))}`,
    );
    const identityVisits = (value: unknown): number => {
      if (!value || typeof value !== "object") return 0;
      const node = value as Record<string, unknown>;
      return (
        (node.Alias === "identity" ? visits([node]) : 0) +
        Object.values(node).reduce<number>((sum, child) => sum + identityVisits(child), 0)
      );
    };
    expect(identityVisits(plan.rows)).toBeLessThanOrEqual(mode === "host-index" ? 10 : 300);
  }
});

test("a selective lookup uses the host equality index without copying the target collection", async () => {
  await defineRecordIndexes(f.db, owner, indexes, "host-index");
  const { queryIn } = createRecordQueries(f.db, owner);
  try {
    await f.db.transaction(async (tx) => {
      const result = await queryIn(tx, {
        index: "resources",
        fields: ["group"],
        where: { field: "id", op: "eq", value: "299" },
        limit: 1,
      });
      expect(result.records.map((r) => r.fields.group)).toEqual(["release"]);
      const table = await tx.execute(sql`SELECT to_regclass('pg_temp.pstdio_query_matches') AS name`);
      if (table.rows[0].name)
        expect((await tx.execute(sql`SELECT count(*)::int AS n FROM pg_temp.pstdio_query_matches`)).rows).toEqual([
          { n: 0 },
        ]);
    });
  } finally {
    await records.defineIndexes(indexes);
  }
});
