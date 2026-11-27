import { type SQL, sql } from "drizzle-orm";
import { recordQueryTextOrders } from "pstdio-sync/records";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";

type PredicateCache = Map<string, { column: string; value: SQL }>;
const bindings = new WeakMap<
  StorageRecordIndex,
  {
    original: StorageRecordIndex;
    fields: Map<string, string>;
    predicates: PredicateCache;
    shared: Set<string>;
  }
>();

const sharedPredicates = (index: StorageRecordIndex) => {
  const uses = new Map<string, number>();
  const visit = (predicate: StoragePredicate): boolean => {
    let complex = "exists" in predicate || "test" in predicate;
    let children: StoragePredicate[] = [];
    if ("all" in predicate) children = predicate.all;
    else if ("any" in predicate) children = predicate.any;
    else if ("not" in predicate) children = [predicate.not];
    for (const child of children) complex = visit(child) || complex;
    // An exists predicate starts another record scope; only cache its root here.
    if (complex) {
      const key = JSON.stringify(predicate);
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
    return complex;
  };
  for (const field of Object.values(index.fields)) for (const entry of field.cases ?? []) visit(entry.when);
  return new Set([...uses].filter(([, count]) => count > 1).map(([key]) => key));
};

/** A statement-local index copy prevents repeated metrics from repeating correlated lookups. */
export const createQueryFieldCache = (original: StorageRecordIndex) => {
  const index = { ...original };
  const textOrder = recordQueryTextOrders.get(original);
  if (textOrder) recordQueryTextOrders.set(index, textOrder);
  const fields = new Map<string, string>();
  const predicates: PredicateCache = new Map();
  bindings.set(index, { original, fields, predicates, shared: sharedPredicates(original) });
  return { index, fields, predicates };
};

export const queryFieldCacheSourceSql = (
  cache: ReturnType<typeof createQueryFieldCache>,
  where: SQL,
  read: (name: string) => SQL,
  source: SQL = sql`records`,
) => {
  const fields = [
    ...[...cache.fields].map(([name, column]) => sql`${read(name)} AS ${sql.identifier(column)}`),
    ...[...cache.predicates.values()].map(({ column, value }) => sql`${value} AS ${sql.identifier(column)}`),
  ];
  // Keep SQL NULL distinct from JSON null, and leave complete bodies out of the temporary relation.
  return sql`(WITH cached_fields AS MATERIALIZED (
    SELECT record_id, revision, owner_id, ${sql.join(fields, sql`, `)}
    FROM ${source} WHERE ${where}
  ) SELECT * FROM cached_fields) AS records`;
};

export const cachedQueryFieldSql = (index: StorageRecordIndex, name: string, alias?: string): SQL | undefined => {
  const binding = bindings.get(index);
  if (!binding || (alias !== undefined && alias !== "records")) return;
  const field = index.fields[name];
  // Compile outer conditions against cached leaves.
  if (!field || (!field.format && (field.cases || field.expression))) return;
  const { fields } = binding;
  let column = fields.get(name);
  if (!column) {
    column = `aggregate_field_${fields.size}`;
    fields.set(name, column);
  }
  return sql`${sql.identifier(alias ?? "records")}.${sql.identifier(column)}`;
};

export const cachedQueryPredicateSql = (
  index: StorageRecordIndex,
  predicate: StoragePredicate,
  alias: string | undefined,
  read: (original: StorageRecordIndex) => SQL,
): SQL | undefined => {
  const binding = bindings.get(index);
  if (!binding || (alias !== undefined && alias !== "records")) return;
  const key = JSON.stringify(predicate);
  if (!binding.shared.has(key)) return;
  let cached = binding.predicates.get(key);
  if (!cached) {
    cached = { column: `predicate_${binding.predicates.size}`, value: read(binding.original) };
    binding.predicates.set(key, cached);
  }
  return sql`${sql.identifier(alias ?? "records")}.${sql.identifier(cached.column)}`;
};
