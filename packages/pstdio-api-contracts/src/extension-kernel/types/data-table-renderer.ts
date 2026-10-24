import type { Localizable } from "../l10n";
import type { CollectionPage, CollectionPageRequest } from "./collection-page";
import type { ViewFilterGroup, ViewSort } from "./collection-view";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { JsonValue, Struct } from "./json";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";
import type { ViewToolbarAction } from "./view-toolbar-action";

export type DataTableRendererResourceRef = ResourceRef;

/** Display settings stored in a data table view. */
export interface DataTableRendererSettings {
  /** A groupable column id, or "none". */
  grouping: string;
  rowNumbers: boolean;
  wrapRows: boolean;
  showStats: boolean;
  hiddenColumns: string[];
  /** Column ids in display order. An empty list means the declared order. */
  columnOrder: string[];
}

/** What a data table view shows until a contribution or a saved view says otherwise. */
export const DEFAULT_DATA_TABLE_SETTINGS: DataTableRendererSettings = {
  grouping: "none",
  rowNumbers: true,
  wrapRows: false,
  showStats: true,
  hiddenColumns: [],
  columnOrder: [],
};

export interface DataTableRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings?: Partial<DataTableRendererSettings>;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
}

export interface DataTableRendererQueryParams {
  /** Present for queryMode: "paged". Apply all view controls before selecting these rows. */
  page?: CollectionPageRequest;
  renderer: RendererContext;
  /** The view's full filter. Paged providers apply it before pagination; legacy providers also get local filtering. */
  filter: ViewFilterGroup;
  /** The view's sorts, first level first. Paged providers apply them before pagination; legacy providers also get local sorting. */
  sorts: ViewSort[];
  settings: DataTableRendererSettings;
}

export interface DataTableRendererThemeColor {
  light: string;
  dark: string;
  foreground?: { light: string; dark: string };
}

export type DataTableRendererColumnStat =
  | { type: "unique" }
  | { type: "histogram"; bins?: number }
  | { type: "top-values"; limit?: number };

export type DataTableRendererColumnRenderer =
  | { type: "json" }
  | { type: "color-scale"; stops: Array<{ value: number; color: DataTableRendererThemeColor }> }
  | {
      type: "categorical-color";
      categories: Array<{
        value: string | number | boolean | null;
        color: DataTableRendererThemeColor;
      }>;
    };

export interface DataTableRendererColumn {
  id: string;
  label?: Localizable<string>;
  /** How filters and sorts compare the column. Without it, the type is inferred from the values. */
  type?: "string" | "number" | "boolean" | "date";
  /** Offers the column under Grouping in the table's Display menu. */
  groupable?: boolean;
  /** Whether this column can be filtered. Defaults to true. */
  filterable?: boolean;
  description?: Localizable<string>;
  icon?: string;
  hidden?: boolean;
  stat?: DataTableRendererColumnStat;
  renderer?: DataTableRendererColumnRenderer;
}

export interface DataTableRendererRow {
  id: string;
  values: Record<string, JsonValue>;
  resource?: DataTableRendererResourceRef;
}

export interface DataTableRendererQueryResult {
  /** Required for queryMode: "paged"; full-result providers omit it. */
  page?: CollectionPage;
  rows: DataTableRendererRow[];
  columns?: DataTableRendererColumn[];
}

export interface DataTableRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  destructive?: boolean;
  command: CommandRef<TParams, unknown>;
}

export interface DataTableRendererSelectionAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  destructive?: boolean;
  command: CommandRef<TParams, unknown>;
}

export type DataTableRendererRowActivationHandler = RendererCallback<{ row: DataTableRendererRow }, void>;

export interface DataTableRendererContribution extends RendererContributionBase {
  /** Opt in to bounded provider-owned filtering, sorting, search and paging. */
  queryMode?: "paged";
  toolbarActions?: ViewToolbarAction[];
  columns?: DataTableRendererColumn[];
  query: RendererCallback<DataTableRendererQueryParams, DataTableRendererQueryResult>;
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableRendererSelectionAction[];
  rowActions?: DataTableRendererRowAction[];
  onRowActivate?: DataTableRendererRowActivationHandler;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  defaultSettings?: Partial<DataTableRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  defaultViews?: DataTableRendererSavedView[];
  defaultActiveViewId?: string;
}
