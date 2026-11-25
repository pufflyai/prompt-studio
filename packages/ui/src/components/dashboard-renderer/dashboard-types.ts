import type { ReactNode } from "react";
import type { DataTableProps } from "../data-table/types";

export type DashboardWidgetKind = "metric" | "line" | "bar" | "scatter" | "ring" | "table" | "custom";
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

export interface DashboardScatterPoint {
  x: number;
  y: number;
  label?: string;
  /** Color group, such as a cluster assignment. */
  group?: string;
}

/** Live data stays separate from the serializable dashboard definition. */
export interface DashboardDataSource {
  id: string;
  name: string;
  metric?: { value: string | number; description?: string };
  series?: DashboardSeriesPoint[];
  scatter?: { points: DashboardScatterPoint[]; xLabel?: string; yLabel?: string };
  table?: Pick<DataTableProps, "data" | "columnTypes">;
  /** Caller-owned widget body, such as an interactive chart with its own marks and controls. */
  content?: ReactNode;
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
  /** Replace the built-in header and place the dashboard controls in a caller-owned toolbar. */
  renderToolbar?: (controls: ReactNode) => ReactNode;
}

export const layoutModes = [
  { id: "vertical", name: "Compact up" },
  { id: "horizontal", name: "Compact left" },
  { id: "free", name: "Free placement" },
];
export const widgetKinds: { id: DashboardWidgetKind; name: string }[] = [
  { id: "metric", name: "Metric" },
  { id: "line", name: "Line chart" },
  { id: "bar", name: "Bar chart" },
  { id: "scatter", name: "Scatterplot" },
  { id: "ring", name: "Ring chart" },
  { id: "table", name: "Table" },
  { id: "custom", name: "Custom" },
];

export const sourcesForKind = (sources: DashboardDataSource[], kind: DashboardWidgetKind) =>
  sources.filter((source) => {
    if (kind === "custom") return source.content !== undefined;
    if (kind === "scatter") return source.scatter !== undefined;
    if (kind === "ring") return source.series !== undefined;
    if (source.content === undefined && source.scatter === undefined) return true;
    if (kind === "metric") return source.metric !== undefined;
    if (kind === "table") return source.table !== undefined;
    return source.series !== undefined;
  });

export const widgetLabel = (widget: DashboardWidget, sourceName?: string) =>
  widget.title.trim() ||
  (widget.kind === "custom" ? sourceName : undefined) ||
  widgetKinds.find(({ id }) => id === widget.kind)?.name ||
  "Widget";
