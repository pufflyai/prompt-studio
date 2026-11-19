import assert from "node:assert/strict";
import { type SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { StoragePredicate } from "pstdio-sync-contracts";
import {
  pageOrderSql,
  predicateSql,
  recordFieldSql,
  recordIndexKeys,
  recordScopeSql,
  sortFieldSql,
} from "../../services/extension-storage/record-query-sql";
import { active, definition, definitions, elapsed, type Fixture, fields } from "./fixture";

export const representations = ["current", "compact", "typed"] as const;
export type Representation = (typeof representations)[number];
const table = { current: "storage_current_records", compact: "ps239_compact", typed: "ps239_typed" };
const compactValue = (alias: string) =>
  sql`jsonb_build_object(${sql.join(
    fields.flatMap((name) => [sql`${name}::text`, recordFieldSql(definition, name, alias)]),
    sql`, `,
  )})`;
const columns = sql.raw(
  "workbench_id, extension_id, record_id, status_id, archived, position, id_key, priority, parent_id",
);
const typedSelect = (
  alias: string,
) => sql`${sql.identifier(alias)}.workbench_id, ${sql.identifier(alias)}.extension_id, ${sql.identifier(alias)}.record_id,
  ${sortFieldSql(definition, "statusId", alias)}, (${recordFieldSql(definition, "archived", alias)} #>> '{}')::boolean,
  ${sortFieldSql(definition, "position", alias)}, ${sortFieldSql(definition, "id", alias)},
  ${sortFieldSql(definition, "priority", alias)}, ${sortFieldSql(definition, "parentId", alias)}`;

// These disposable sidecars are deliberately outside the application schema/migration catalog.
// The trigger runs inside the canonical commit/apply transaction, including rollback.
export const installProjection = async (f: Fixture, kind: "compact" | "typed") => {
  const { db } = f;
  // Typed output decoding in this first prototype supports ASCII scalar IDs only.
  // Do not silently change the public string/null/missing contract outside this fixture.
  if (kind === "typed")
    for (const value of f.values)
      for (const name of fields) {
        const scalar = value[name as keyof typeof value];
        assert(
          typeof scalar !== "string" ||
            [...scalar].every((character) => character.charCodeAt(0) > 0 && character.charCodeAt(0) < 128),
          "Typed diagnostic requires ASCII scalar IDs",
        );
      }
  if (kind === "compact") {
    await db.execute(sql`CREATE TABLE ps239_compact (
      workbench_id text NOT NULL, extension_id text NOT NULL, record_id text NOT NULL, deleted boolean NOT NULL,
      value jsonb,
      PRIMARY KEY(workbench_id, extension_id, record_id))`);
    await db.execute(
      sql`INSERT INTO ps239_compact SELECT workbench_id, extension_id, record_id, deleted, ${compactValue("r")} FROM storage_current_records r WHERE ${recordScopeSql(f.owner, definition, "r")}`,
    );
    for (const index of definitions) {
      const keys = recordIndexKeys(index);
      await db.execute(
        sql`CREATE INDEX ${sql.identifier(`ps239_compact_${index.name}`)} ON ps239_compact (${sql.join(keys, sql`, `)}) WHERE ${recordScopeSql(f.owner, index)}`,
      );
      for (const [n, key] of keys.slice(0, index.equality?.length ?? 0).entries())
        await db.execute(
          sql`CREATE STATISTICS ${sql.identifier(`ps239_compact_${index.name}_s${n}`)} ON ${key} FROM ps239_compact`,
        );
    }
    await db.execute(
      literalStatement(sql`CREATE FUNCTION ps239_update() RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.workbench_id <> ${sql.raw(`'${f.owner.workbenchId}'`)} OR NEW.extension_id <> 'ext.example' THEN RETURN NEW; END IF;
        INSERT INTO ps239_compact SELECT NEW.workbench_id, NEW.extension_id, NEW.record_id, NEW.deleted, ${compactValue("new")}
        ON CONFLICT (workbench_id, extension_id, record_id) DO UPDATE SET deleted=excluded.deleted, value=excluded.value
        WHERE ps239_compact.deleted IS DISTINCT FROM excluded.deleted OR ps239_compact.value IS DISTINCT FROM excluded.value;
        RETURN NEW;
      END $body$`),
    );
  } else {
    await db.execute(sql`CREATE TABLE ps239_typed (
      workbench_id text NOT NULL, extension_id text NOT NULL, record_id text NOT NULL,
      status_id bytea, archived boolean, position bytea, id_key bytea, priority bytea, parent_id bytea,
      PRIMARY KEY(workbench_id, extension_id, record_id))`);
    await db.execute(
      sql`INSERT INTO ps239_typed (${columns}) SELECT ${typedSelect("r")} FROM storage_current_records r WHERE ${recordScopeSql(f.owner, definition, "r")}`,
    );
    await db.execute(
      sql`CREATE INDEX ps239_typed_order ON ps239_typed (archived, substring(position from 1 for 512), substring(id_key from 1 for 512), record_id COLLATE "C")`,
    );
    await db.execute(
      sql`CREATE INDEX ps239_typed_status ON ps239_typed (archived, status_id, substring(position from 1 for 512), substring(id_key from 1 for 512), record_id COLLATE "C")`,
    );
    await db.execute(
      literalStatement(sql`CREATE FUNCTION ps239_update() RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.workbench_id <> ${sql.raw(`'${f.owner.workbenchId}'`)} OR NEW.extension_id <> 'ext.example' THEN RETURN NEW; END IF;
        IF NEW.deleted THEN DELETE FROM ps239_typed WHERE workbench_id=NEW.workbench_id AND extension_id=NEW.extension_id AND record_id=NEW.record_id; RETURN NEW; END IF;
        INSERT INTO ps239_typed (${columns}) SELECT ${typedSelect("new")}
        ON CONFLICT (workbench_id, extension_id, record_id) DO UPDATE SET status_id=excluded.status_id, archived=excluded.archived, position=excluded.position, id_key=excluded.id_key, priority=excluded.priority, parent_id=excluded.parent_id
        WHERE (ps239_typed.status_id, ps239_typed.archived, ps239_typed.position, ps239_typed.id_key, ps239_typed.priority, ps239_typed.parent_id)
          IS DISTINCT FROM (excluded.status_id, excluded.archived, excluded.position, excluded.id_key, excluded.priority, excluded.parent_id);
        RETURN NEW;
      END $body$`),
    );
  }
  await db.execute(
    sql`CREATE TRIGGER ps239_projection AFTER INSERT OR UPDATE ON storage_current_records FOR EACH ROW EXECUTE FUNCTION ps239_update()`,
  );
  await db.execute(sql`ANALYZE ${sql.identifier(table[kind])}`);
};

export const removeProjection = async (f: Fixture, kind: "compact" | "typed") => {
  await f.db.execute(sql`DROP TRIGGER ps239_projection ON storage_current_records`);
  await f.db.execute(sql`DROP FUNCTION ps239_update()`);
  await f.db.execute(sql`DROP TABLE ${sql.identifier(table[kind])}`);
};

export const scenarios = ["first", "status", "next", "tail", "counts"] as const;
export type Scenario = (typeof scenarios)[number];
export const querySql = (f: Fixture, kind: Representation, scenario: Scenario) => {
  let where: StoragePredicate = active;
  if (scenario === "status") where = { all: [active, { field: "statusId", op: "eq", value: "ready" }] };
  if (scenario === "tail") where = { all: [active, { field: "id", op: "eq", value: f.values.at(-2)!.id }] };
  if (kind !== "typed") {
    const index = scenario === "status" ? definitions[1] : definition;
    const scope = sql`${recordScopeSql(f.owner, index)} AND ${predicateSql(index, where)}`;
    const statement =
      scenario === "counts"
        ? sql`SELECT ${recordFieldSql(index, "statusId")} AS status, count(*)::int AS count FROM storage_current_records WHERE ${scope} GROUP BY ${recordFieldSql(index, "statusId")}`
        : sql`SELECT record_id, ${compactValue("storage_current_records")} AS fields FROM storage_current_records WHERE ${scope} ORDER BY ${pageOrderSql(index)} LIMIT 100 OFFSET ${scenario === "next" ? 100 : 0}`;
    if (kind === "current") return statement;
    return replaceTable(statement, "storage_current_records", "ps239_compact");
  }
  const scope = sql`workbench_id=${f.owner.workbenchId} AND extension_id=${f.owner.extensionId} AND archived=false`;
  if (scenario === "counts")
    return sql`SELECT to_jsonb(convert_from(status_id, 'UTF8')) AS status, count(*)::int AS count FROM ps239_typed WHERE ${scope} GROUP BY status_id`;
  let match = sql``;
  if (scenario === "status") match = sql`AND status_id=convert_to('ready', 'UTF8')`;
  if (scenario === "tail") match = sql`AND id_key=convert_to(${f.values.at(-2)!.id}, 'UTF8')`;
  return sql`SELECT record_id, jsonb_build_object('id', convert_from(id_key, 'UTF8'), 'statusId', convert_from(status_id, 'UTF8'), 'archived', archived, 'position', convert_from(position, 'UTF8'), 'priority', convert_from(priority, 'UTF8'), 'parentId', convert_from(parent_id, 'UTF8')) AS fields FROM ps239_typed WHERE ${scope} ${match}
    ORDER BY substring(position from 1 for 512) ASC NULLS LAST, position ASC NULLS LAST, substring(id_key from 1 for 512) ASC NULLS LAST, id_key ASC NULLS LAST, record_id COLLATE "C" ASC LIMIT 100 OFFSET ${scenario === "next" ? 100 : 0}`;
};

// Replace identifiers in generated SQL without interpolating parameter values into SQL text.
const replaceTable = (statement: SQL, from: string, to: string) => {
  const query = new PgDialect().sqlToQuery(statement);
  const parts = query.sql
    .split(/(\$\d+)/g)
    .map((part: string) =>
      /^\$\d+$/.test(part) ? sql`${query.params[Number(part.slice(1)) - 1]}` : sql.raw(part.replaceAll(from, to)),
    );
  return sql.join(parts, sql``);
};

const literalStatement = (statement: SQL) => {
  const query = new PgDialect().sqlToQuery(statement);
  return sql.raw(
    query.sql.replace(/\$(\d+)/g, (_, n) => {
      const value = query.params[Number(n) - 1];
      assert.equal(typeof value, "string");
      return `'${(value as string).replaceAll("'", "''")}'`;
    }),
  );
};

export const checkParity = async (f: Fixture, kind: Representation) => {
  for (const scenario of scenarios) {
    const control = await f.db.execute(querySql(f, "current", scenario));
    const candidate = await f.db.execute(querySql(f, kind, scenario));
    const normalize = (rows: Record<string, unknown>[]) =>
      scenario === "counts"
        ? rows
            .map((row) => ({ status: row.status, count: row.count }))
            .sort((a, b) => String(a.status).localeCompare(String(b.status)))
        : rows;
    assert.deepEqual(normalize(candidate.rows), normalize(control.rows), `${kind}/${scenario}`);
  }
};

export const indexInventory = async (f: Fixture) =>
  (
    await f.db.execute(
      sql`SELECT tablename, indexname, indexdef, pg_relation_size(indexname::regclass)::text AS bytes FROM pg_indexes WHERE tablename IN ('storage_current_records', 'ps239_compact', 'ps239_typed') ORDER BY tablename, indexname`,
    )
  ).rows;
export const sizeInventory = async (f: Fixture) =>
  (
    await f.db.execute(
      sql`SELECT relname, pg_relation_size(oid)::text AS heap_bytes, pg_indexes_size(oid)::text AS index_bytes, pg_total_relation_size(oid)::text AS total_bytes FROM pg_class WHERE relname IN ('storage_current_records', 'ps239_compact', 'ps239_typed') ORDER BY relname`,
    )
  ).rows;
export const timedInstallation = async (f: Fixture, kind: "compact" | "typed") =>
  elapsed(() => installProjection(f, kind));
