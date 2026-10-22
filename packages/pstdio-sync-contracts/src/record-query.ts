import type { StorageRecord } from "./authoring";
import type { Json } from "./json";

export interface StorageIndexField {
  /** A path within the record value. */
  path: string[];
  type: "string" | "number" | "boolean" | "array";
}

export interface StorageRecordIndex {
  name: string;
  /** Selectable fields. Declaring a field does not make it an equality key. */
  fields: Record<string, StorageIndexField>;
  /** Explicit equality keys preceding the sort keys. Defaults to no equality keys. */
  equality?: string[];
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  /** Restrict this index to complete record addresses with this prefix. */
  prefix?: string;
}

export type StoragePredicate =
  | { all: StoragePredicate[] }
  | { any: StoragePredicate[] }
  | { not: StoragePredicate }
  | { field: string; op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "equalsIgnoreCase"; value: Json }
  | { field: string; op: "in" | "notIn"; value: Json[] }
  | { field: string; op: "empty" | "notEmpty" | "exists" | "missing" };

export interface StorageRecordQuery {
  index: string;
  where?: StoragePredicate;
  fields?: string[];
  /** Between 1 and 100. Defaults to 100. */
  limit?: number;
  /** Opaque. A changed owner revision rejects the cursor; restart from the first page. */
  cursor?: string;
  /** Direct zero-based page offset. Cannot be combined with a cursor. Skipped rows stay in the database. */
  offset?: number;
  /** Expected owner revision for direct page jumps; reject if committed data changed. */
  revision?: string;
}

export interface StorageQueryRecord {
  recordId: string;
  revision: string;
  fields: Record<string, Json>;
}

export interface StorageQueryPage {
  records: StorageQueryRecord[];
  revision: string;
  cursor: string | null;
}

export interface StorageAggregateQuery {
  index: string;
  where?: StoragePredicate;
  groupBy?: string;
}

export interface StorageRecordQueries {
  /** Install or upgrade local indexes explicitly. Prefer the extension's storageIndexes declaration. */
  defineIndexes(indexes: StorageRecordIndex[]): Promise<void>;
  query(query: StorageRecordQuery): Promise<StorageQueryPage>;
  aggregate(query: StorageAggregateQuery): Promise<{
    revision: string;
    count: number;
    groups: { value: Json; count: number }[];
  }>;
  /** At most 100 complete addresses, in request order, including missing records and tombstones. */
  readMany(recordIds: string[]): Promise<StorageRecord[]>;
}
