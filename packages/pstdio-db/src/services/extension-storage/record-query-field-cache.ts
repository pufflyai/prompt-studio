import { type SQL, sql } from "drizzle-orm";
import { recordQueryTextOrders } from "pstdio-sync/records";
import type { StorageRecordIndex } from "pstdio-sync-contracts";

const bindings = new WeakMap<StorageRecordIndex, Map<string, string>>();

/** A statement-local index copy prevents repeated metrics from repeating correlated lookups. */
export const createQueryFieldCache = (original: StorageRecordIndex) => {
  const index = { ...original };
  const textOrder = recordQueryTextOrders.get(original);
  if (textOrder) recordQueryTextOrders.set(index, textOrder);
  const fields = new Map<string, string>();
  bindings.set(index, fields);
  return { index, fields };
};

export const queryFieldCacheSourceSql = (
  cache: ReturnType<typeof createQueryFieldCache>,
  where: SQL,
  read: (name: string) => SQL,
) => {
  const fields = [...cache.fields].map(([name, column]) => sql`${read(name)} AS ${sql.identifier(column)}`);
  // Keep SQL NULL distinct from JSON null, and leave complete bodies out of the temporary relation.
  return sql`(WITH cached_fields AS MATERIALIZED (
    SELECT record_id, revision, workbench_id, extension_id, ${sql.join(fields, sql`, `)}
    FROM storage_current_records WHERE ${where}
  ) SELECT * FROM cached_fields) AS storage_current_records`;
};

export const cachedQueryFieldSql = (index: StorageRecordIndex, name: string, alias?: string): SQL | undefined => {
  const fields = bindings.get(index);
  if (!fields || (alias !== undefined && alias !== "storage_current_records")) return;
  const field = index.fields[name];
  // Compile conditions against cached leaves, rather than caching each whole condition separately.
  if (!field || (!field.format && (field.cases || field.expression))) return;
  let column = fields.get(name);
  if (!column) {
    column = `aggregate_field_${fields.size}`;
    fields.set(name, column);
  }
  return sql`${sql.identifier(alias ?? "storage_current_records")}.${sql.identifier(column)}`;
};
