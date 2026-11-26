import { isDeepStrictEqual as equal } from "node:util";
import { sql } from "drizzle-orm";
import type { PgInsertValue } from "drizzle-orm/pg-core";
import type { OrderedRecord } from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import { jsonBatches } from "../services/extension-storage/json-batches";
import {
  canonicalRecordFromRow,
  confirmedRecordBase,
  stableRecordColumns,
} from "../services/extension-storage/ordered-record-row";
import { decodeProjectionValue, encodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import type { DbClient } from "./connection.pglite";
import { records } from "./schemas.pg";
import { decodeUpgradeBytes } from "./upgrade-bytes";
import { readUpgradeRows } from "./upgrade-rows";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Row = Record<string, unknown>;
type Stored = typeof records.$inferSelect;
const key = (row: Row) => JSON.stringify([row.owner_id, row.record_id]);
const canonicalInput = (raw: Row) => {
  const bytes = raw.state instanceof Uint8Array ? raw.state : decodeUpgradeBytes(raw.state);
  const record = JSON.parse(Buffer.from(bytes).toString()) as OrderedRecord;
  if (record.recordId !== raw.record_id) throw new Error("Canonical record restoration identity changed");
  return record;
};
const restoredCanonicalRow = (raw: Row, existing: Stored | undefined): PgInsertValue<typeof records> | undefined => {
  const record = canonicalInput(raw),
    retained = existing ? canonicalRecordFromRow(existing) : undefined;
  if (retained) {
    if (!equal(retained, record)) throw new Error("Canonical record restoration conflict");
    return;
  }
  return {
    owner_id: raw.owner_id as number,
    record_id: record.recordId,
    ...stableRecordColumns(record),
    revision: null,
    base: confirmedRecordBase(record),
  };
};
const restoredCurrentRow = (raw: Row, existing: Stored | undefined): PgInsertValue<typeof records> | undefined => {
  if (existing && existing.revision !== null) {
    const actual = Object.fromEntries(
      Object.keys(raw).map((k) => [
        k,
        k === "native_sources" ? decodeProjectionValue(existing.native_sources as never) : existing[k as keyof Stored],
      ]),
    );
    if (!equal(actual, raw)) throw new Error("Query record restoration conflict");
    return;
  }
  const confirmed = existing ? canonicalRecordFromRow(existing) : undefined;
  return {
    ...raw,
    native_sources: encodeProjectionValue(raw.native_sources as Json),
    base: confirmed ? confirmedRecordBase(confirmed) : null,
  } as PgInsertValue<typeof records>;
};

/** Released query/canonical snapshots restore independently. Keep both facets until
 * pending membership and legacy conversion are known; never overwrite a restored facet. */
const restoreRecordBatch = async (tx: Transaction, kind: "current" | "canonical", input: Row[]) => {
  const existing = await tx
    .select()
    .from(records)
    .where(
      sql`(owner_id,record_id) IN (${sql.join(
        input.map((row) => sql`(${row.owner_id},${row.record_id})`),
        sql`, `,
      )})`,
    );
  const before = new Map(existing.map((row) => [key(row), row]));
  const changed = input.flatMap((raw) => {
    const row =
      kind === "canonical"
        ? restoredCanonicalRow(raw, before.get(key(raw)))
        : restoredCurrentRow(raw, before.get(key(raw)));
    return row ? [row] : [];
  });
  if (!changed.length) return;
  const queryColumns = {
    deleted: sql`excluded.deleted`,
    value: sql`excluded.value`,
    query_values: sql`excluded.query_values`,
    asset: sql`excluded.asset`,
    shared: sql`excluded.shared`,
    native_sources: sql`excluded.native_sources`,
    native_versions: sql`excluded.native_versions`,
    record_lifetime: sql`excluded.record_lifetime`,
    revision: sql`excluded.revision`,
  };
  await tx
    .insert(records)
    .values(changed)
    .onConflictDoUpdate({
      target: [records.owner_id, records.record_id],
      set: { base: sql`excluded.base`, ...(kind === "current" ? queryColumns : {}) },
    });
};

/** Bound both facets: a tiny tombstone source can meet a large confirmed body
 * already restored into this row. Read only sizes before hydrating that join. */
export const restoreRecordRows = async (tx: Transaction, kind: "current" | "canonical", input: Row[]) => {
  if (!input.length) return;
  const { rows } = await tx.execute<{ owner_id: number; record_id: string; bytes: number }>(sql`
    SELECT owner_id,record_id,octet_length(row_to_json(r)::text) AS bytes FROM records r
    WHERE (owner_id,record_id) IN (${sql.join(
      input.map((row) => sql`(${row.owner_id},${row.record_id})`),
      sql`, `,
    )})`);
  const sizes = new Map(rows.map((row) => [key(row), row.bytes]));
  let batch: Row[] = [],
    bytes = 0;
  for (const row of input) {
    const size = (sizes.get(key(row)) ?? 0) + Buffer.byteLength(JSON.stringify(row));
    if (batch.length && bytes + size > 4 * 1024 * 1024) {
      await restoreRecordBatch(tx, kind, batch);
      batch = [];
      bytes = 0;
    }
    batch.push(row);
    bytes += size;
  }
  if (batch.length) await restoreRecordBatch(tx, kind, batch);
};

type Change = ReturnType<typeof stableRecordColumns> & {
  owner_id: number;
  record_id: string;
  normalize: boolean;
  base: string | null;
};
const finalRecordChange = (row: Stored, pending: boolean): Change | undefined => {
  if (pending && row.base !== null) return;
  if (!pending && row.base === null) return;
  const canonical = canonicalRecordFromRow(row);
  if (pending) return { ...row, normalize: false, base: Buffer.from(confirmedRecordBase(canonical)).toString("hex") };
  if (!canonical) return { ...row, normalize: false, meta: null, base: null };
  const stable = stableRecordColumns(canonical),
    normalize = row.revision === null || canonical.deleted;
  const restored = canonicalRecordFromRow({ ...row, meta: stable.meta, base: null, ...(normalize ? stable : {}) });
  if (!equal(restored, canonical)) throw new Error("Settled query and canonical record restoration disagree");
  return { ...stable, owner_id: row.owner_id, record_id: row.record_id, normalize, base: null };
};
const finalizeBatch = async (db: DbClient, rows: Stored[]) =>
  db.transaction(async (tx) => {
    const positions = rows.map((row) => ({ owner_id: row.owner_id, record_id: row.record_id }));
    const { rows: touched } = await tx.execute<{
      owner_id: number;
      record_id: string;
    }>(sql`SELECT input.owner_id,input.record_id
    FROM jsonb_to_recordset(${JSON.stringify(positions)}::jsonb) AS input(owner_id int,record_id text)
    WHERE EXISTS(SELECT 1 FROM operations WHERE owner_id=input.owner_id AND envelope IS NOT NULL AND settled_epoch IS NULL AND touches @> ARRAY[input.record_id])`);
    const pending = new Set(touched.map(key));
    const changes = rows.flatMap((row) => {
      const change = finalRecordChange(row, pending.has(key(row)));
      return change ? [change] : [];
    });
    for (const batch of jsonBatches(changes))
      await tx.execute(sql`UPDATE records target SET meta=input.meta,base=decode(input.base,'hex'),
    value=CASE WHEN input.normalize THEN input.value ELSE target.value END,
    asset=CASE WHEN input.normalize THEN input.asset ELSE target.asset END,
    shared=CASE WHEN input.normalize THEN input.shared ELSE target.shared END,
    native_sources=CASE WHEN input.normalize THEN input.native_sources ELSE target.native_sources END,
    deleted=CASE WHEN input.normalize THEN input.deleted ELSE target.deleted END,
    record_lifetime=CASE WHEN input.normalize THEN input.record_lifetime ELSE target.record_lifetime END
    FROM jsonb_to_recordset(${batch}::jsonb) AS input(owner_id int,record_id text,meta jsonb,base text,normalize boolean,
      value jsonb,asset jsonb,shared jsonb,native_sources jsonb,deleted boolean,record_lifetime text)
    WHERE target.owner_id=input.owner_id AND target.record_id=input.record_id`);
  });
const finalizeRows = async (db: DbClient) => {
  let rows: Stored[] = [],
    bytes = 0;
  const flush = async () => {
    if (rows.length) await finalizeBatch(db, rows);
    rows = [];
    bytes = 0;
  };
  // Settled rows already in the final format require no normalization. Pending touches
  // still need their confirmed base even when their current row has no base yet.
  const where = sql`base IS NOT NULL OR EXISTS (SELECT 1 FROM operations o WHERE o.owner_id=t.owner_id
    AND o.envelope IS NOT NULL AND o.settled_epoch IS NULL AND o.touches @> ARRAY[t.record_id])`;
  for await (const input of readUpgradeRows(db, { table: "records", keys: ["owner_id", "record_id"], where })) {
    const size = Buffer.byteLength(JSON.stringify(input));
    if (rows.length && (rows.length === 100 || bytes + size > 4 * 1024 * 1024)) await flush();
    rows.push(input as Stored);
    bytes += size;
  }
  await flush();
};

/** A durable empty snapshot marks final normalization before DDL. It is removed
 * only after source restoration and pending legacy conversion finish. */
export const prepareRecordRowFinalization = async (db: DbClient, path: string) => {
  const [{ legacy }] = (
    await db.execute<{ legacy: boolean }>(
      sql`SELECT to_regclass('public.storage_current_records') IS NOT NULL AS legacy`,
    )
  ).rows;
  const interrupted =
    path !== ":memory:" &&
    ((await Bun.file(`${path}-storage_ordered_records-owners-upgrade.jsonl`).exists()) ||
      (await Bun.file(`${path}-storage_current_records-owners-upgrade.jsonl`).exists()));
  const marker = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "projects",
      keys: ["id"],
      where: sql`false`,
      name: "record-row-finalization",
      keepEmpty: true,
      capture: legacy || interrupted,
    },
    async () => {},
  );
  if (!marker) return;
  return async () => {
    await finalizeRows(db);
    await marker.complete();
  };
};
