import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { StatusRef } from "./contribution-identity";
import type { Struct } from "./json";
import type { NavigationTarget } from "./navigation-target";
import type { ParamObjectSchema } from "./params";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";

export type KanbanRendererViewMode = "board" | "list";
export type KanbanRendererSortDirection = "asc" | "desc";

export interface KanbanRendererEnumOption {
  value: string;
  label: Localizable<string>;
  color?: string;
  icon?: string | null;
}

export type KanbanRendererAttributeType =
  | { kind: "enum"; options: KanbanRendererEnumOption[] }
  | { kind: "enum-multi"; options: KanbanRendererEnumOption[] }
  | { kind: "status"; statuses: StatusRef }
  | { kind: "string" }
  | { kind: "date" }
  | { kind: "number" }
  | { kind: "user" };

export interface CollectionBadgeItem {
  id: string;
  label: string;
  icon?: string;
  resource?: ResourceRef;
}

export type KanbanRendererAttributeDisplay = { kind: "badge-list"; itemsAttributeId: string };

export interface KanbanRendererAttributeDescriptor {
  id: string;
  label: Localizable<string>;
  type: KanbanRendererAttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: KanbanRendererAttributeDisplay;
}

export interface KanbanRendererSettings {
  viewMode: KanbanRendererViewMode;
  columnGrouping: string;
  rowGrouping: string;
  ordering: {
    attributeId: string;
    direction: KanbanRendererSortDirection;
  };
  displayProperties: string[];
}

export type KanbanRendererFilterState = Record<string, string[]>;

export interface KanbanRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
  isDefault?: boolean;
}

export interface KanbanRendererQueryParams {
  renderer: RendererContext;
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
}

export type KanbanRendererResourceRef = ResourceRef;

export interface KanbanRendererRow {
  id: string;
  title: string;
  resource?: KanbanRendererResourceRef;
  attributes: Record<string, unknown>;
}

export interface KanbanRendererColumnAction {
  id: string;
  label: Localizable<string>;
  icon?: string;
}

export interface KanbanRendererBoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererColumnAction[];
}

export interface KanbanRendererQueryResult {
  rows: KanbanRendererRow[];
  attributes?: KanbanRendererAttributeDescriptor[];
  boardColumnConfigs?: Record<string, KanbanRendererBoardColumnConfig>;
}

export interface KanbanRendererCreateRowContribution<TParams extends ParamObjectSchema = ParamObjectSchema> {
  command: CommandRef<Struct, unknown>;
  title?: Localizable<string>;
  submitLabel?: Localizable<string>;
  columnParam?: string;
  params?: TParams;
  attributesParam?: string;
  attachments?: {
    command: CommandRef<Struct, unknown>;
    resourceParam: string;
    fileParam: string;
  };
  labels?: {
    cancel?: Localizable<string>;
    properties?: Localizable<string>;
    submitError?: Localizable<string>;
    removeFile?: Localizable<string>;
  };
}

export interface KanbanRendererRowAction<TParams extends Struct = Struct> {
  id: string;
  label: Localizable<string>;
  icon?: string;
  command: CommandRef<TParams, unknown>;
  destructive?: boolean;
}

export type KanbanRendererRowActivationHandler = RendererCallback<
  { row: KanbanRendererRow },
  undefined | NavigationTarget
>;

export interface KanbanRendererContribution extends RendererContributionBase {
  attributes?: KanbanRendererAttributeDescriptor[];
  query: RendererCallback<KanbanRendererQueryParams, KanbanRendererQueryResult>;
  onAttributeChange?: RendererCallback<{ rowId: string; attributeId: string; value: unknown }, unknown>;
  onReorder?: RendererCallback<{ rowId: string; beforeRowId?: string }, unknown>;
  onColumnAction?: RendererCallback<{ columnId: string; actionId: string }, unknown>;
  createRow?: KanbanRendererCreateRowContribution;
  rowActions?: KanbanRendererRowAction[];
  onRowActivate?: KanbanRendererRowActivationHandler;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
}
