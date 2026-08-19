import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { JsonValue, Struct } from "./json";
import type { ExtensionNavigationTarget } from "./navigation-target";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";

export type DataTableRendererResourceRef = ResourceRef;

export interface DataTableRendererQueryParams {
  renderer: RendererContext;
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

export type DataTableRendererRowActivationHandler = RendererCallback<
  { row: DataTableRendererRow },
  undefined | ExtensionNavigationTarget
>;

export interface DataTableRendererContribution extends RendererContributionBase {
  columns?: DataTableRendererColumn[];
  query: RendererCallback<DataTableRendererQueryParams, DataTableRendererQueryResult>;
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableRendererSelectionAction[];
  rowActions?: DataTableRendererRowAction[];
  onRowActivate?: DataTableRendererRowActivationHandler;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}
