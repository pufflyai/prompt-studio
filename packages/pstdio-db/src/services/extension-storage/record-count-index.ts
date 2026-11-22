import { type SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { identityQueryText } from "./record-identity-query";
import { projectionKey } from "./record-projection-codec";
import { recordFieldSql, recordScopeSql, sqlLiteral } from "./record-query-sql";
import { identityQueryKey } from "./resource-query-values";
import { ensureStorageOwner } from "./storage-owner-key";

type Writer = Pick<DbClient, "execute">;
type IndexWriter = Pick<DbClient, "execute" | "select" | "insert">;
const ddl = (query: SQL) => new PgDialect().sqlToQuery(query.inlineParams()).sql;
const literal = (value: string) => ddl(sqlLiteral(value));

// Each physical index owns its counts. For identity-backed views the two halves of
// membership can arrive in either order, including within the same transaction.
export const installCountIndex = async (
  tx: IndexWriter,
  owner: StorageOwner & { ownerId: number },
  index: StorageRecordIndex,
  name: string,
) => {
  if (!index.countBy?.length) return;
  const counts = `${name}_c`,
    records = `${name}_r`,
    identities = `${name}_i`;
  const adjust = `${name}_add`,
    flag = `${name}_flag`,
    trigger = `${name}_tr`;
  // Names originate from the core-generated physical index digest. Quote all declaration values.
  const createFunction = async (id: string, args: string, returns: string, body: string) =>
    tx.execute(sql.raw(`CREATE FUNCTION ${id}(${args}) RETURNS ${returns} LANGUAGE plpgsql AS ${literal(body)}`));
  const dimensions = (alias: string) => {
    const pieces = index.countBy!.map((key) => {
      const field = recordFieldSql(index, key, alias);
      return sql`(CASE WHEN ${field} IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(${sqlLiteral(projectionKey(key))}, ${field}) END)`;
    });
    return ddl(sql`(${sql.join(pieces, sql` || `)})`);
  };
  const resource = (alias: string) =>
    index.identity ? ddl(identityQueryText(recordFieldSql(index, index.identity.idField, alias))) : "NULL::text";
  const scope = (alias: string) => ddl(recordScopeSql(owner, { ...index, identity: undefined }, alias));
  const coreOwner = index.identity ? String(await ensureStorageOwner(tx, { ...owner, extensionId: "pstdio" })) : "-1";
  const workbench = literal(owner.workbenchId),
    extension = literal(owner.extensionId);
  const kind = literal(index.identity?.kind ?? "");
  const named = (alias: string) =>
    `(${alias}.revision IS NOT NULL AND NOT ${alias}.deleted AND (${alias}.query_values #> ARRAY[${literal(identityQueryKey)},'shorthand']) IS NOT NULL)`;
  const mapped = (alias: string) => `${alias}.current AND ${alias}.extension_id=${extension} AND ${alias}.kind=${kind}`;
  const visible = (id: string) =>
    index.identity ? `EXISTS(SELECT 1 FROM ${identities} WHERE rid=${id} AND mapped AND named)` : "true";
  // Oversize values share a sentinel. Queries fall back to the canonical aggregate
  // while any eligible row uses it, so an unbounded string never breaks a write.
  const bounded = (value: string) =>
    `CASE WHEN octet_length((${value})::text)>1500 THEN 'null'::jsonb ELSE (${value}) END`;
  await tx.execute(sql.raw(`CREATE TABLE ${counts}(dims jsonb PRIMARY KEY, n bigint NOT NULL)`));
  await tx.execute(sql.raw(`CREATE TABLE ${records}(address text PRIMARY KEY, rid text, dims jsonb NOT NULL)`));
  if (index.identity) {
    await tx.execute(sql.raw(`CREATE INDEX ON ${records} USING hash(rid)`));
    await tx.execute(
      sql.raw(`CREATE TABLE ${identities}(rid text PRIMARY KEY, mapped boolean NOT NULL, named boolean NOT NULL)`),
    );
    await tx.execute(
      sql.raw(`INSERT INTO ${identities}
      SELECT resource_id,true,${named("c")} FROM resource_numbers m
      LEFT JOIN records c ON c.owner_id=${coreOwner} AND c.record_id=m.resource_id
      WHERE m.project_id=${workbench} AND ${mapped("m")}`),
    );
  }
  await tx.execute(
    sql.raw(`INSERT INTO ${records} SELECT record_id,${resource("src")},${bounded(dimensions("src"))}
    FROM records src WHERE ${scope("src")}`),
  );
  await tx.execute(
    sql.raw(`INSERT INTO ${counts} SELECT dims,count(*) FROM ${records} r WHERE ${visible("r.rid")} GROUP BY dims`),
  );
  await createFunction(
    adjust,
    "k jsonb, delta bigint",
    "void",
    `BEGIN
    INSERT INTO ${counts} VALUES(k,delta) ON CONFLICT(dims) DO UPDATE SET n=${counts}.n+excluded.n;
    DELETE FROM ${counts} WHERE dims=k AND n=0;
  END`,
  );
  if (index.identity)
    await createFunction(
      flag,
      "key text, mapping boolean, present boolean",
      "void",
      `DECLARE was boolean; now_visible boolean; g record; BEGIN
      SELECT mapped AND named INTO was FROM ${identities} WHERE rid=key;
      IF mapping AND present THEN
        SELECT EXISTS(SELECT 1 FROM records c WHERE c.owner_id=${coreOwner}
          AND c.record_id=key AND ${named("c")}) INTO now_visible;
        INSERT INTO ${identities} VALUES(key,true,now_visible) ON CONFLICT(rid) DO UPDATE SET named=excluded.named;
      ELSIF mapping THEN
        DELETE FROM ${identities} WHERE rid=key;
        now_visible := false;
      ELSE
        UPDATE ${identities} SET named=present WHERE rid=key;
        IF NOT FOUND THEN RETURN; END IF;
        now_visible := present;
      END IF;
      IF coalesce(was,false) <> now_visible THEN
        FOR g IN SELECT dims,count(*) AS n FROM ${records} WHERE rid=key GROUP BY dims LOOP
          PERFORM ${adjust}(g.dims,CASE WHEN now_visible THEN g.n ELSE -g.n END);
        END LOOP;
      END IF;
    END`,
    );
  const syncFlag = (mapping: boolean) => {
    const test = mapping ? mapped : (v: string) => `${named(v)}`;
    const scope = (v: string) => (mapping ? `${v}.project_id=${workbench}` : `${v}.owner_id=${coreOwner}`);
    const id = mapping ? "resource_id" : "record_id";
    return `old_flag := TG_OP<>'INSERT' AND ${scope("OLD")} AND ${test("OLD")};
      new_flag := TG_OP<>'DELETE' AND ${scope("NEW")} AND ${test("NEW")};
      IF old_flag AND (NOT new_flag OR OLD.${id}<>NEW.${id}) THEN PERFORM ${flag}(OLD.${id},${mapping},false); END IF;
      IF new_flag AND (NOT old_flag OR OLD.${id}<>NEW.${id}) THEN PERFORM ${flag}(NEW.${id},${mapping},true); END IF;`;
  };
  await createFunction(
    trigger,
    "",
    "trigger",
    `DECLARE old_flag boolean; new_flag boolean; old_row ${records}%ROWTYPE; new_dims jsonb; new_id text; BEGIN
    ${
      index.identity
        ? `IF TG_TABLE_NAME='resource_numbers' THEN ${syncFlag(true)} RETURN NULL; END IF;
    ${syncFlag(false)}`
        : ""
    }
    old_flag := TG_OP<>'INSERT' AND ${scope("old")};
    new_flag := TG_OP<>'DELETE' AND ${scope("new")};
    IF new_flag THEN new_dims := ${bounded(dimensions("new"))}; new_id := ${resource("new")}; END IF;
    IF old_flag THEN
      SELECT * INTO STRICT old_row FROM ${records} WHERE address=OLD.record_id;
      IF new_flag AND OLD.record_id=NEW.record_id AND old_row.rid IS NOT DISTINCT FROM new_id AND old_row.dims=new_dims THEN RETURN NULL; END IF;
      DELETE FROM ${records} WHERE address=OLD.record_id;
      IF ${visible("old_row.rid")} THEN PERFORM ${adjust}(old_row.dims,-1); END IF;
    END IF;
    IF new_flag THEN
      INSERT INTO ${records} VALUES(NEW.record_id,new_id,new_dims);
      IF ${visible("new_id")} THEN PERFORM ${adjust}(new_dims,1); END IF;
    END IF;
    RETURN NULL;
  END`,
  );
  for (const table of ["records", ...(index.identity ? ["resource_numbers"] : [])]) {
    const belongs = (row: string) =>
      table === "resource_numbers"
        ? `(${row}.project_id=${workbench} AND ${mapped(row)})`
        : `(${scope(row)}${index.identity ? ` OR (${row}.owner_id=${coreOwner} AND ${named(row)})` : ""})`;
    for (const [verb, condition] of [
      ["INSERT", belongs("new")],
      ["DELETE", belongs("old")],
      ["UPDATE", `${belongs("old")} OR ${belongs("new")}`],
    ]) {
      await tx.execute(
        sql.raw(`CREATE TRIGGER ${trigger}_${verb.toLowerCase()} AFTER ${verb} ON ${table}
        FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION ${trigger}()`),
      );
    }
  }
};

export const dropCountIndex = async (tx: Writer, index: StorageRecordIndex, name: string) => {
  if (!index.countBy?.length) return;
  for (const table of ["records", ...(index.identity ? ["resource_numbers"] : [])])
    for (const verb of ["insert", "delete", "update"])
      await tx.execute(sql.raw(`DROP TRIGGER IF EXISTS ${name}_tr_${verb} ON ${table}`));
  await tx.execute(
    sql.raw(`DROP FUNCTION IF EXISTS ${name}_tr(), ${name}_flag(text,boolean,boolean), ${name}_add(jsonb,bigint)`),
  );
  await tx.execute(sql.raw(`DROP TABLE IF EXISTS ${name}_r, ${name}_i, ${name}_c`));
};
