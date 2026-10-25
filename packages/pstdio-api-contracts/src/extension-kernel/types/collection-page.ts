import type { JsonValue } from "./json";

/** A bounded read after applying the view's filter, sorts, search and grouping. */
export interface CollectionPageRequest {
  limit: number;
  /** Next-page cursor returned by this provider. Omit for a direct offset jump. */
  cursor?: string;
  /** Zero-based row offset, for table page and last-page navigation. */
  offset: number;
  /** Reject a continuation if the committed query revision has changed. */
  revision?: string;
  /** Visible field IDs, plus fields needed for grouping and row actions. */
  fields: string[];
  search: string;
  /** Collapsed table groups are excluded before paging, not removed from a returned page. */
  collapsedGroups?: string[];
}

export interface CollectionPageGroup {
  /** Grouping field ID and its value. A missing value is represented by null. */
  field: string;
  value: JsonValue;
  count: number;
  /** A subgroup's column, when two grouping levels are active. */
  parent?: { field: string; value: JsonValue };
}

/** Bounded column summaries computed before pagination. */
export type CollectionPageStatistic =
  | { type: "unique"; count: number }
  | {
      type: "histogram";
      histogram: { min: number; max: number; bins: { start: number; end: number; count: number }[] } | null;
    }
  | { type: "top-values"; values: { label: string; count: number; percentage: number }[] };

/** Counts and rows must describe the same committed revision and owner scope. */
export interface CollectionPage {
  revision: string;
  cursor: string | null;
  /** Rows matching the filter before search. */
  total: number;
  /** Rows matching both filter and search, excluding collapsed table groups. */
  filteredTotal: number;
  groups: CollectionPageGroup[];
  /** Requested table column statistics, keyed by field ID. */
  statistics?: Record<string, CollectionPageStatistic>;
}
