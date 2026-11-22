import { sql } from "drizzle-orm";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { DbClient } from "./connection.pglite";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Row = {
  project_id: string;
  resource_id: string;
  shorthand: string;
  prefix: string;
  value: string;
  extension_id: string;
  kind: string;
  current: boolean;
  alias: boolean;
  canonical: boolean;
  canonical_current: boolean;
};
const decimal = (value: unknown) => {
  const text = String(value);
  if (!/^-?\d+$/u.test(text) || BigInt(text) < -9223372036854775808n || BigInt(text) > 9223372036854775807n)
    throw new Error("Invalid exported resource number");
  return text;
};
const string = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Invalid exported resource number address");
  return value;
};
const normalized = (source: string, input: Record<string, unknown>): Row[] => {
  const canonical = source === "storage_ordered_resource_numbers";
  const base = {
    project_id: string(input.workbench_id),
    resource_id: string(input.resource_id),
    extension_id: typeof input.extension_id === "string" ? input.extension_id : "",
    kind: typeof input.kind === "string" ? input.kind : "",
    prefix: string(input.prefix),
    current: source === "storage_resource_identities",
    alias: source === "storage_resource_aliases",
    canonical,
    canonical_current: false,
  };
  if (!canonical) {
    const shorthand = string(input.shorthand);
    let prefix = base.prefix,
      value = decimal(input.value);
    // Released 0002 added these sentinel defaults before rebuilding older number indexes.
    // Recover only that omitted metadata; exports and changed-target conflict checks stay exact.
    if (prefix === "" && BigInt(value) === 0n) {
      const separator = shorthand.lastIndexOf("-"),
        suffix = shorthand.slice(separator + 1);
      if (separator > 0 && /^[1-9]\d*$/u.test(suffix) && BigInt(suffix) <= 9223372036854775807n) {
        prefix = shorthand.slice(0, separator);
        value = suffix;
      }
    }
    return [{ ...base, shorthand, prefix, value }];
  }
  const high = decimal(input.high_water);
  const rows = [{ ...base, shorthand: `${base.prefix}-${high}`, value: high }];
  if (input.current === true && input.value !== null) {
    const value = decimal(input.value);
    rows.push({ ...base, shorthand: `${base.prefix}-${value}`, value, canonical_current: true });
  }
  return rows;
};

/** Restore each released facet without overwriting another facet or a changed restart target. */
export const restoreResourceNumbers = async (tx: Transaction, source: string, input: Record<string, unknown>[]) => {
  const unique = new Map<string, Row>();
  const key = (row: Pick<Row, "project_id" | "shorthand" | "resource_id">) =>
    JSON.stringify([row.project_id, row.shorthand, row.resource_id]);
  for (const row of input.flatMap((row) => normalized(source, row))) {
    const old = unique.get(key(row));
    unique.set(key(row), {
      ...row,
      alias: row.alias || old?.alias === true,
      canonical_current: row.canonical_current || old?.canonical_current === true,
    });
  }
  const rows = [...unique.values()],
    encoded = JSON.stringify(rows);
  const existing =
    await tx.execute<Row>(sql`SELECT DISTINCT t.project_id,t.resource_id,t.shorthand,t.prefix,t.value::text,
    t.extension_id,t.kind,t.current,t.alias,t.canonical,t.canonical_current FROM resource_numbers t
    INNER JOIN jsonb_to_recordset(${encoded}::jsonb) AS i(project_id text,resource_id text,shorthand text)
      USING(project_id,resource_id) WHERE t.shorthand=i.shorthand OR t.current OR t.canonical_current`);
  const byKey = new Map(existing.rows.map((row) => [key(row), row]));
  for (const row of rows) {
    // Keep an equivalent historical spelling coherent until the normal identity rename.
    // A pending namespace change with another prefix remains an independent claim.
    const shown = existing.rows.find(
      (previous) =>
        previous.current &&
        previous.project_id === row.project_id &&
        previous.resource_id === row.resource_id &&
        previous.kind === row.kind &&
        canonicalExtensionId(previous.extension_id) === canonicalExtensionId(row.extension_id),
    );
    if (!row.current && row.canonical && shown) row.extension_id = shown.extension_id;
    const previous = byKey.get(key(row));
    if (
      previous &&
      (previous.prefix !== row.prefix ||
        previous.value !== row.value ||
        ((row.current || row.canonical_current) &&
          (previous.current || previous.canonical_current) &&
          (canonicalExtensionId(previous.extension_id) !== canonicalExtensionId(row.extension_id) ||
            previous.kind !== row.kind)))
    )
      throw new Error("Resource number restoration conflict");
    if (
      existing.rows.some(
        (previous) =>
          previous.project_id === row.project_id &&
          previous.resource_id === row.resource_id &&
          previous.shorthand !== row.shorthand &&
          ((row.current && previous.current) || (row.canonical_current && previous.canonical_current)),
      )
    )
      throw new Error("Resource number current-claim restoration conflict");
  }
  await tx.execute(sql`INSERT INTO resource_numbers
    (project_id,resource_id,shorthand,prefix,value,extension_id,kind,current,alias,canonical,canonical_current)
    SELECT project_id,resource_id,shorthand,prefix,value,extension_id,kind,current,alias,canonical,canonical_current
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS i(project_id text,resource_id text,shorthand text,prefix text,value bigint,
      extension_id text,kind text,current boolean,alias boolean,canonical boolean,canonical_current boolean)
    ON CONFLICT(project_id,shorthand,resource_id) DO UPDATE SET
      current=resource_numbers.current OR excluded.current,alias=resource_numbers.alias OR excluded.alias,canonical=resource_numbers.canonical OR excluded.canonical,
      canonical_current=resource_numbers.canonical_current OR excluded.canonical_current,
      extension_id=CASE WHEN excluded.current OR (excluded.canonical AND NOT resource_numbers.current) OR resource_numbers.extension_id=''
        THEN excluded.extension_id ELSE resource_numbers.extension_id END,
      kind=CASE WHEN excluded.current OR (excluded.canonical AND NOT resource_numbers.current) OR resource_numbers.kind=''
        THEN excluded.kind ELSE resource_numbers.kind END`);
};

/** Confirmed floors were independent of the document FK graph; preserve them before its generated replacement. */
export const prepareCanonicalNumberUpgrade = async (db: DbClient, path: string) => {
  const pending: Record<string, unknown>[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    bytes = 0;
    await db.transaction((tx) => restoreResourceNumbers(tx, "storage_ordered_resource_numbers", batch));
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_ordered_resource_numbers",
      keys: ["workbench_id", "resource_id", "prefix"],
      name: "canonical-resource-numbers",
      archive: "storage_ordered_resource_numbers",
    },
    async (row) => {
      const size = Buffer.byteLength(JSON.stringify(row));
      if (pending.length && bytes + size > 4 * 1024 * 1024) await flush();
      pending.push(row);
      bytes += size;
      if (pending.length === 200) await flush();
    },
    async (row) => ({
      ...row,
      high_water: decimal(row.high_water),
      value: row.value === null ? null : decimal(row.value),
    }),
  );
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
