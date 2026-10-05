import type { Localizable } from "../l10n";
import type { ViewFilterGroup, ViewSort } from "./collection-view";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { StatusRef } from "./contribution-identity";
import type { Struct } from "./json";
import type { ParamObjectSchema } from "./params";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";
import type { ViewToolbarAction } from "./view-toolbar-action";

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
  /** Maps old enum IDs when saved views are read. Row values must still be booleans. */
  | { kind: "boolean"; legacyValues?: Record<string, boolean> }
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
  /**
   * @deprecated Use the view's `sorts`. The host still sends the first sort here, or
   * `{ attributeId: "manual", direction: "asc" }` when the view has no sorts.
   */
  ordering: {
    attributeId: string;
    direction: KanbanRendererSortDirection;
  };
  displayProperties: string[];
}

/** Display settings stored in a view. Order lives in the view's `sorts`. */
export type KanbanRendererViewSettings = Omit<KanbanRendererSettings, "ordering"> & {
  /** @deprecated Use the view's `sorts`. */
  ordering?: KanbanRendererSettings["ordering"];
};

/** @deprecated Use `ViewFilterGroup`. */
export type KanbanRendererFilterState = Record<string, string[]>;

export interface KanbanRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings: KanbanRendererViewSettings;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  /** @deprecated Use `filter`. When both are set, `filter` wins. */
  filters?: KanbanRendererFilterState;
  /** @deprecated Use the renderer's defaultActiveViewId instead. */
  isDefault?: boolean;
}

export interface KanbanRendererQueryParams {
  renderer: RendererContext;
  settings: KanbanRendererSettings;
  /** The view's full filter. Use it only to narrow what you load; the renderer applies it to the rows you return. */
  filter: ViewFilterGroup;
  /** The view's sorts, first level first. The renderer applies them to the rows you return. */
  sorts: ViewSort[];
  /**
   * @deprecated Read `filter`. Derived from the root "is any of" and "has any of" rules when the root
   * conjunction is "and".
   */
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

export type KanbanRendererRowActivationHandler = RendererCallback<{ row: KanbanRendererRow }, void>;

export interface KanbanRendererContribution extends RendererContributionBase {
  toolbarActions?: ViewToolbarAction[];
  attributes?: KanbanRendererAttributeDescriptor[];
  query: RendererCallback<KanbanRendererQueryParams, KanbanRendererQueryResult>;
  onAttributeChange?: RendererCallback<{ rowId: string; attributeId: string; value: unknown }, unknown>;
  onReorder?: RendererCallback<{ rowId: string; beforeRowId?: string }, unknown>;
  onColumnAction?: RendererCallback<{ columnId: string; actionId: string }, unknown>;
  createRow?: KanbanRendererCreateRowContribution;
  rowActions?: KanbanRendererRowAction[];
  onRowActivate?: KanbanRendererRowActivationHandler;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  /** @deprecated Use `defaultFilter`. When both are set, `defaultFilter` wins. */
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
}
