import type { Localizable } from "../l10n";
import type { CollectionPage, CollectionPageRequest } from "./collection-page";
import type { ViewFilterGroup, ViewSort } from "./collection-view";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { Struct } from "./json";
import type { NavigationTarget, NavigationTargetPage } from "./navigation-target";
import type { ParamObjectSchema } from "./params";
import type { RendererContributionBase, RendererEventReference } from "./renderer-base";
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
  color?: string;
  tooltip?: string;
  action?: NavigationTarget;
  /** @deprecated Use action, which also supports panels and commands. */
  target?: NavigationTargetPage;
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
  displayProperties: string[];
}

/** Display settings stored in a view. Order lives in the view's `sorts`. */
export type KanbanRendererViewSettings = KanbanRendererSettings;

export interface KanbanRendererSavedView {
  id: string;
  title: Localizable<string>;
  settings: KanbanRendererViewSettings;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
}

export interface KanbanRendererQueryParams {
  /** Present for queryMode: "paged". Apply all view controls before selecting these rows. */
  page?: CollectionPageRequest;
  renderer: RendererContext;
  settings: KanbanRendererSettings;
  /** The view's full filter. Paged providers apply it before pagination; legacy providers also get local filtering. */
  filter: ViewFilterGroup;
  /** The view's sorts, first level first. Paged providers apply them before pagination; legacy providers also get local sorting. */
  sorts: ViewSort[];
}

export type KanbanRendererResourceRef = ResourceRef;

export interface KanbanRendererRow {
  id: string;
  title: string;
  /** Navigate using query data immediately, without running an activation callback. */
  target?: NavigationTargetPage;
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
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragIn?: boolean;
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererColumnAction[];
}

export interface KanbanRendererQueryResult {
  /** Required for queryMode: "paged"; full-result providers omit it. */
  page?: CollectionPage;
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

/** One drop, including destination grouping values and optional manual placement. */
export interface KanbanRendererMove {
  rowId: string;
  attributes: Record<string, unknown>;
  /** Omitted in sorted views. An empty object appends in manual order. */
  order?: { beforeRowId?: string };
}

export interface KanbanRendererContribution extends RendererContributionBase {
  /** Opt in to bounded provider-owned filtering, sorting, search and paging. */
  queryMode?: "paged";
  /** Saves the complete drop once. Takes precedence over legacy move callbacks. */
  onMove?: RendererCallback<KanbanRendererMove, unknown>;
  /** Events that change filter fields/options. Omit to retain content-event refresh. */
  schemaRefreshEvents?: readonly RendererEventReference[];
  toolbarActions?: ViewToolbarAction[];
  attributes?: KanbanRendererAttributeDescriptor[];
  query: RendererCallback<KanbanRendererQueryParams, KanbanRendererQueryResult>;
  onAttributeChange?: RendererCallback<{ rowId: string; attributeId: string; value: unknown }, unknown>;
  onColumnAction?: RendererCallback<{ columnId: string; actionId: string }, unknown>;
  createRow?: KanbanRendererCreateRowContribution;
  rowActions?: KanbanRendererRowAction[];
  onRowActivate?: KanbanRendererRowActivationHandler;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
}
