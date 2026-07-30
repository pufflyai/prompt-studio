import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { JsonObject, JsonValue, Struct } from "./json";

export interface DataTableRendererResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface DataTableRendererQueryParams {
  rendererId: string;
  projectId?: string;
  modeId?: string;
  resource?: DataTableRendererResourceRef;
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
  command: CommandRef<TParams, unknown> | string;
}

export interface DataTableRendererSelectionAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  destructive?: boolean;
  command: CommandRef<TParams, unknown> | string;
}

export interface DataTableRendererContribution {
  title: Localizable<string>;
  resourceKind?: string;
  columns?: DataTableRendererColumn[];
  queryCommand: CommandRef<DataTableRendererQueryParams, DataTableRendererQueryResult> | string;
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableRendererSelectionAction[];
  rowActions?: DataTableRendererRowAction[];
  initialPageSize?: number;
  pageSizeOptions?: number[];
  emptyTitle?: Localizable<string>;
  emptyDescription?: Localizable<string>;
}
