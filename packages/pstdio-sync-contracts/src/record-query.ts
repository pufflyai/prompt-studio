import type { StorageRecord } from "./authoring";
import type { Json } from "./json";
import type { StorageComputedField, StorageExpression } from "./query-expression";
import type { ViewDateFormat } from "./view-date";
export interface StorageDateFormat extends ViewDateFormat {
  field: string;
}

export interface StorageIndexField {
  /** A path within the record value. */
  path?: string[];
  type: "string" | "number" | "boolean" | "array" | "object";
  /** Deterministic local projection, maintained from canonical record/native text in the commit transaction. */
  derive?:
    | { kind: "collectionKey" }
    | { kind: "scopeId" }
    | { kind: "expression"; expression: StorageExpression }
    | { kind: "selections"; selectionPath: string[] }
    | { kind: "stringList"; trim?: boolean; exclude?: string[] }
    | { kind: "tokens"; pattern: string; split: string; itemPattern: string; trim?: boolean }
    | { kind: "string" }
    | { kind: "timestamp" }
    | { kind: "date"; source: StorageIndexField; format: ViewDateFormat }
    | { kind: "markdownTitle"; fallbackPath?: string[]; empty?: string }
    | { kind: "selection"; selectionPath: string[]; knownValues?: string[] };
  /** Query-local expression; supplied through computed, never installed as an index. */
  expression?: StorageExpression;
  cases?: NonNullable<StorageComputedField["cases"]>;
  otherwise?: Json;
  /** Query-local viewer formatting, supplied through formats. */
  format?: StorageDateFormat;
  /** First matching related projection in record-ID order, constrained to this extension and workbench. */
  lookup?: { index: string; on: StorageRelatedSelection["on"]; field: string };
}

export interface StorageRecordIndex {
  name: string;
  /** Join this owner's core resource identities before selection, paging and aggregates. */
  identity?: { kind: string; idField: string; shorthandField: string; aliasesField?: string };
  /** Recursive labels from this index's parent chain; cycles stop at the first repeated record. */
  hierarchy?: { idField: string; parentField: string; labelField: string; breadcrumbField: string; separator: string };
  /** Extension collection in the selected scope; field paths are relative to its items. */
  collection?: string;
  /** Records whose `records.id` key in the selected scope starts with this prefix, such as moved collection items. */
  keyPrefix?: string;
  /** Selectable fields. Declaring a field does not make it an equality key. */
  fields: Record<string, StorageIndexField>;
  /** Explicit equality keys preceding the sort keys. Defaults to no equality keys. */
  equality?: string[];
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  /** Maintain exact counts for combinations of up to four local, derived scalar fields. */
  countBy?: string[];
  /** Additional local sort orders served by physical indexes. The default result order stays in orderBy. */
  alternateOrders?: { field: string; direction: "asc" | "desc" }[][];
  /** Restrict this index to complete record addresses with this prefix. */
  prefix?: string;
}

export type StoragePredicate =
  | { test: StorageExpression }
  | { exists: StorageRelatedSelection }
  | { all: StoragePredicate[] }
  | { any: StoragePredicate[] }
  | { not: StoragePredicate }
  | {
      field: string;
      op:
        | "eq"
        | "ne"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "contains"
        | "overlaps"
        | "containsAll"
        | "equalsIgnoreCase"
        | "textContains"
        | "hasKey";
      value: Json;
    }
  | { field: string; op: "in" | "notIn"; value: Json[] }
  | { field: string; op: "empty" | "notEmpty" | "exists" | "missing" };

export interface StorageRelatedSelection {
  /** An installed index in the same extension and workbench as the source. */
  index: string;
  /** Equality by default; contains/containedBy join a string array to a string field. */
  on: { sourceField: string; relatedField: string; op?: "eq" | "contains" | "containedBy" }[];
  /** Require a matching relationship for every member of a source string array. */
  every?: { field: string; as: string; matches: "one" | "some" };
  where?: StoragePredicate;
}

export interface StorageRecordQuery {
  index: string;
  /** Viewer text ordering: numeric, case/accent insensitive. NUL/unpaired surrogates
   * form a binary-ordered partition after valid text ascending; missing stays last. */
  textOrder?: { field: string; locale: string };
  /** Select up to 100 records in stable first-ready dependency order within where.
   * References outside the selection are satisfied; cycles take the next sorted record.
   * No cursor or offset: consume a batch, then query the remaining records again. */
  dependencyOrder?: { idField: string; dependenciesField: string };
  /** Query-local fields for related indexes used by predicates and lookups. */
  related?: Record<string, { computed?: StorageRecordQuery["computed"]; formats?: StorageRecordQuery["formats"] }>;
  computed?: Record<string, StorageComputedField>;
  formats?: Record<string, StorageDateFormat>;
  /** Overrides the declared order using selectable scalar fields. Record ID breaks ties. */
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  where?: StoragePredicate;
  fields?: string[];
  /** Between 0 and 500. Defaults to 100. Zero validates the query/revision/cursor without selecting rows; returns no cursor. */
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
  related?: StorageRecordQuery["related"];
  computed?: Record<string, StorageComputedField>;
  formats?: Record<string, StorageDateFormat>;
  where?: StoragePredicate;
  groupBy?: string | string[];
  /** At most 16 numeric metrics; typed missing/null/invalid values do not contribute. */
  metrics?: Record<string, { operation: "sum" | "min" | "max"; field: string }>;
  /** Up to 16 scalar column summaries; summaries never materialize the source values. */
  statistics?: Record<
    string,
    { field: string } & (
      | { type: "unique" }
      | { type: "histogram"; bins?: number }
      | { type: "top-values"; limit?: number; locale?: string }
    )
  >;
  /** Opaque digest of this selection's record IDs and requested projection fields. */
  fingerprint?: string[];
  /** 1–500 groups. Numeric/multi-field queries default to 500; legacy count-only grouping retains its contract. */
  groupLimit?: number;
}

export interface StorageAggregateResult {
  revision: string;
  count: number;
  metrics?: Record<string, number | null>;
  statistics?: Record<string, StorageStatisticResult>;
  fingerprint?: string;
  groups: { value: Json; count: number; metrics?: Record<string, number | null> }[];
}

export type StorageStatisticResult =
  | { type: "unique"; count: number }
  | {
      type: "histogram";
      histogram: { min: number; max: number; bins: { start: number; end: number; count: number }[] } | null;
    }
  | { type: "top-values"; values: { label: string; count: number; percentage: number }[] };

export interface StorageRecordQueries {
  /** Install or upgrade local indexes explicitly. Prefer the extension's storageIndexes declaration. */
  defineIndexes(indexes: StorageRecordIndex[]): Promise<void>;
  query(query: StorageRecordQuery): Promise<StorageQueryPage>;
  aggregate(query: StorageAggregateQuery): Promise<StorageAggregateResult>;
  /** At most 100 complete addresses, in request order, including missing records and tombstones. */
  readMany(recordIds: string[]): Promise<StorageRecord[]>;
}
