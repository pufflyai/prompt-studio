import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { cachedQueryPredicateSql } from "./record-query-field-cache";
import type { QuerySqlOwner } from "./record-query-owner";
import { relatedRecordPredicateSql } from "./record-related-query";

export const cachedPredicateSql = (
  index: StorageRecordIndex,
  predicate: StoragePredicate,
  alias: string | undefined,
  resolve: ((name: string) => StorageRecordIndex) | undefined,
  owner: QuerySqlOwner | undefined,
) => {
  if (!resolve || !owner) return;
  return cachedQueryPredicateSql(index, predicate, alias, (original) =>
    relatedRecordPredicateSql(owner, original, predicate, resolve, alias ?? "records"),
  );
};
