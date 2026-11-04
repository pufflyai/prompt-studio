import type { KanbanRendererContribution, KanbanRendererRow, KanbanRendererSettings } from "./kanban-renderer";

/** A resource list has one display and one grouping. */
export interface ResourceListRendererSettings extends Omit<KanbanRendererSettings, "viewMode" | "rowGrouping"> {
  showChildren?: boolean;
}

export interface ResourceListRendererRow extends KanbanRendererRow {
  icon?: string;
  /** One level of child resources, rendered underneath their parent. */
  children?: (KanbanRendererRow & { icon?: string })[];
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
