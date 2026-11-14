import type { StorageRecord } from "./authoring";
import type { Json } from "./json";

export interface StorageIndexField {
  /** A path within the record value. */
  path: string[];
  type: "string" | "number" | "boolean" | "array" | "object";
  /** Deterministic text projection, maintained from canonical record/native text in the commit transaction. */
  derive?: { kind: "markdownTitle"; fallbackPath?: string[]; empty?: string };
}

export interface StorageRecordIndex {
  name: string;
  /** Extension collection in the selected scope; field paths are relative to its items. */
  collection?: string;
  /** Selectable fields. Declaring a field does not make it an equality key. */
  fields: Record<string, StorageIndexField>;
  /** Explicit equality keys preceding the sort keys. Defaults to no equality keys. */
  equality?: string[];
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  /** Restrict this index to complete record addresses with this prefix. */
  prefix?: string;
}

export type StoragePredicate =
  | { exists: StorageRelatedSelection }
  | { all: StoragePredicate[] }
  | { any: StoragePredicate[] }
  | { not: StoragePredicate }
  | {
      field: string;
      op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "equalsIgnoreCase" | "textContains" | "hasKey";
      value: Json;
    }
  | { field: string; op: "in" | "notIn"; value: Json[] }
  | { field: string; op: "empty" | "notEmpty" | "exists" | "missing" };

export interface StorageRelatedSelection {
  /** An installed index in the same extension and workbench as the source. */
  index: string;
  /** Equality by default; contains/containedBy join a string array to a string field. */
  on: { sourceField: string; relatedField: string; op?: "eq" | "contains" | "containedBy" }[];
  where?: StoragePredicate;
}

export interface StorageRecordQuery {
  index: string;
  /** Overrides the declared order using selectable scalar fields. Record ID breaks ties. */
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  where?: StoragePredicate;
  fields?: string[];
  /** Between 1 and 500. Defaults to 100. */
  limit?: number;
  /** Opaque. A changed owner revision rejects the cursor; restart from the first page. */
  cursor?: string;
  /** Direct zero-based page offset. Cannot be combined with a cursor. Skipped rows stay in the database. */
  offset?: number;
  /** Expected owner query revision; reject if committed data or installed index definitions changed. */
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
  groupBy?: string | string[];
  /** At most 16 numeric metrics; typed missing/null/invalid values do not contribute. */
  metrics?: Record<string, { operation: "sum" | "min" | "max"; field: string }>;
  /** 1–500 groups. Numeric/multi-field queries default to 500; legacy count-only grouping retains its contract. */
  groupLimit?: number;
}

export interface StorageAggregateResult {
  revision: string;
  count: number;
  metrics?: Record<string, number | null>;
  groups: { value: Json; count: number; metrics?: Record<string, number | null> }[];
}

export interface StorageRecordQueries {
  /** Install or upgrade local indexes explicitly. Prefer the extension's storageIndexes declaration. */
  defineIndexes(indexes: StorageRecordIndex[]): Promise<void>;
  query(query: StorageRecordQuery): Promise<StorageQueryPage>;
  aggregate(query: StorageAggregateQuery): Promise<StorageAggregateResult>;
  /** At most 100 complete addresses, in request order, including missing records and tombstones. */
  readMany(recordIds: string[]): Promise<StorageRecord[]>;
}
