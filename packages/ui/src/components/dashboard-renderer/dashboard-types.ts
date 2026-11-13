import type { ReactNode } from "react";
import type { DataTableProps } from "../data-table/types";

export type DashboardWidgetKind = "metric" | "line" | "bar" | "table";
export type DashboardLayoutMode = "vertical" | "horizontal" | "free";
export type DashboardResizeHandle = "w" | "e" | "s" | "sw" | "se";

/** Coordinates in the saved 12-column grid. Narrow layouts are derived without changing these values. */
export interface GridPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: string;
  title: string;
  kind: DashboardWidgetKind;
  /** ID of a caller-supplied data source. */
  source: string;
  layout: GridPlacement;
}

export interface DashboardDefinition {
  mode: DashboardLayoutMode;
  widgets: DashboardWidget[];
}

export interface DashboardSeriesPoint {
  label: string;
  value: number;
  /** Grouped bar series stack by label. */
  group?: string;
}

/** Live data stays separate from the serializable dashboard definition. */
export interface DashboardDataSource {
  id: string;
  name: string;
  metric?: { value: string | number; description?: string };
  series?: DashboardSeriesPoint[];
  table?: Pick<DataTableProps, "data" | "columnTypes">;
}

export interface DashboardRendererProps {
  value: DashboardDefinition;
  sources: DashboardDataSource[];
  /** Omit for read-only use. Apply emits the entire definition; Cancel emits nothing.
   * Reject a save to retain the draft and show an inline retry action. */
  onChange?: (value: DashboardDefinition) => void | Promise<void>;
  title?: string;
  /** Caller-owned filters or refresh controls, kept above the scroll area. */
  actions?: ReactNode;
}

export const layoutModes = [
  { id: "vertical", name: "Compact up" },
  { id: "horizontal", name: "Compact left" },
  { id: "free", name: "Free placement" },
];
export const widgetKinds = [
  { id: "metric", name: "Metric" },
  { id: "line", name: "Line chart" },
  { id: "bar", name: "Bar chart" },
  { id: "table", name: "Table" },
];
export const widgetLabel = (widget: DashboardWidget) =>
  widget.title.trim() || widgetKinds.find(({ id }) => id === widget.kind)?.name || "Widget";
