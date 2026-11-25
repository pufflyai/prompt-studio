import { type SQL, sql } from "drizzle-orm";
import { isLocaleQueryText } from "pstdio-sync/records";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { identityQueryText } from "./record-identity-query";
import type { QuerySqlOwner } from "./record-query-sql";

type Predicate = Extract<StoragePredicate, { field: string }>;
const selectedNames = (index: StorageRecordIndex, predicate: Predicate) => {
  if (!("value" in predicate)) return;
  if (predicate.field === index.identity?.shorthandField) {
    if (predicate.op === "eq") return [predicate.value];
    if (predicate.op === "in") return predicate.value;
  }
  if (predicate.field === index.identity?.aliasesField) {
    if (predicate.op === "contains") return [predicate.value];
    if (predicate.op === "overlaps" && Array.isArray(predicate.value)) return predicate.value;
  }
};

/** Probe a bounded name selection once; avoid decoding every identity/alias for each source row. */
export const identityPredicateSql = (
  index: StorageRecordIndex,
  predicate: Predicate,
  owner: QuerySqlOwner | undefined,
  id: () => SQL,
) => {
  if (!index.identity || !owner) return;
  const field = index.fields[predicate.field];
  if (field?.format || field?.cases || field?.lookup || index.hierarchy?.breadcrumbField === predicate.field) return;
  const selected = selectedNames(index, predicate);
  if (!selected) return;
  const names = selected.filter((value): value is string => typeof value === "string" && isLocaleQueryText(value));
  if (!names.length) return sql`false`;
  const values = sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(names)}::jsonb))`;
  const aliases = predicate.field === index.identity.aliasesField;
  return sql`${identityQueryText(id())} IN (
    SELECT selected_identity.resource_id FROM resource_numbers selected_identity
    ${aliases ? sql`INNER JOIN resource_numbers selected_alias ON selected_alias.alias AND selected_alias.project_id = selected_identity.project_id AND selected_alias.resource_id = selected_identity.resource_id` : sql``}
    WHERE selected_identity.current AND selected_identity.project_id = ${owner.workbenchId} AND selected_identity.extension_id = ${owner.extensionId}
      AND selected_identity.kind = ${index.identity.kind}
      AND ${aliases ? sql`selected_alias.shorthand` : sql`selected_identity.shorthand`} = ANY(${values})
  )`;
};
