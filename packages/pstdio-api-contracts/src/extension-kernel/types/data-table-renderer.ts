import type { Localizable } from "../l10n";
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
  renderer: RendererContext;
  /** The view's full filter. Use it only to narrow what you load; the renderer applies it to the rows you return. */
  filter: ViewFilterGroup;
  /** The view's sorts, first level first. The renderer applies them to the rows you return. */
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
  type?: "string" | "number" | "date";
  /** Offers the column under Grouping in the table's Display menu. */
  groupable?: boolean;
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
