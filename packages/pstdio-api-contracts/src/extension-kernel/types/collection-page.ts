import type { StorageStatisticResult } from "pstdio-sync-contracts";
import type { JsonValue } from "./json";

/** Largest page the host requests from a paged table or board provider. */
export const MAX_COLLECTION_PAGE_SIZE = 500;

/** Page size used when a provider does not declare an initial size. */
export const DEFAULT_COLLECTION_PAGE_SIZE = 100;

/** A bounded read after applying the view's filter, sorts, search and grouping. */
export interface CollectionPageRequest {
  /** Maximum returned rows. Zero requests page summaries only. */
  limit: number;
  /** Next-page cursor returned by this provider. Omit for a direct offset jump. */
  cursor?: string;
  /** Zero-based row offset, for table page and last-page navigation. */
  offset: number;
  /** Reject a continuation if the committed query revision has changed. */
  revision?: string;
  /** Visible field IDs, plus fields needed for grouping and row actions. */
  fields: string[];
  /** Displayed fields searched by the native view; excludes hidden grouping and companion data. */
  searchFields?: string[];
  /** Resolved viewer labels keep query search and collapsed groups consistent with native controls. */
  presentation?: Record<string, { emptyGroup: string; options?: { value: string; label: string }[] }>;
  search: string;
  /** Collapsed table groups are excluded before paging, not removed from a returned page. */
  collapsedGroups?: string[];
  /** Browser calendar and date text semantics. CLI providers can use process defaults. */
  viewer?: { locale: string; timeZone: string; now: string };
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
export type CollectionPageStatistic = StorageStatisticResult;

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
