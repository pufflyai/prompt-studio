import type { KanbanRendererContribution, KanbanRendererRow, KanbanRendererSettings } from "./kanban-renderer";

/**
 * A resource list has one display: a list grouped by `columnGrouping`, then by each of
 * `subGroupings` in order. Each level must be a different groupable attribute.
 */
export interface ResourceListRendererSettings extends Omit<KanbanRendererSettings, "viewMode" | "rowGrouping"> {
  showChildren?: boolean;
}

/** A child resource. Children can have their own children, rendered at increasing indents. */
export interface ResourceListRendererChildRow extends KanbanRendererRow {
  icon?: string;
  children?: ResourceListRendererChildRow[];
}

export interface ResourceListRendererRow extends KanbanRendererRow {
  icon?: string;
  /** Child resources, rendered underneath their parent. */
  children?: ResourceListRendererChildRow[];
}

export interface ResourceListRendererContribution
  extends Omit<KanbanRendererContribution, "onMove" | "query" | "defaultSettings" | "defaultViews"> {
  query: import("./context").RendererCallback<
    Omit<import("./kanban-renderer").KanbanRendererQueryParams, "settings"> & {
      settings: ResourceListRendererSettings;
    },
    Omit<import("./kanban-renderer").KanbanRendererQueryResult, "rows"> & { rows: ResourceListRendererRow[] }
  >;
  defaultSettings?: Partial<ResourceListRendererSettings>;
  defaultViews?: (Omit<import("./kanban-renderer").KanbanRendererSavedView, "settings"> & {
    settings: ResourceListRendererSettings;
  })[];
}
