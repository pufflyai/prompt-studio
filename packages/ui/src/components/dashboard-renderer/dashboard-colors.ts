import { chartColor, chartPalette } from "@/components/charts/chart";
import type {
  DashboardColorSettings,
  DashboardDataSource,
  DashboardScatterPoint,
  DashboardSeriesPoint,
  DashboardWidget,
  DashboardWidgetColor,
} from "./dashboard-types";

const colorNames: Record<DashboardWidgetColor, string> = {
  blue: "Blue",
  purple: "Purple",
  teal: "Teal",
  green: "Green",
  orange: "Orange",
  red: "Red",
  pink: "Pink",
  gray: "Gray",
};

export const dashboardColorOptions = [
  { id: "default", name: "Default" },
  ...Object.entries(colorNames).map(([id, name]) => ({ id, name, icon: "circle", color: id })),
];

export const resolveWidgetColor = (color?: DashboardWidgetColor) =>
  color && Object.hasOwn(colorNames, color) ? chartColor(`${color}.500`) : undefined;

export const widgetColorRange = (widget: DashboardWidget, domain: string[]) =>
  domain.map(
    (key, index) => resolveWidgetColor(widget.seriesColors?.[key]) ?? chartPalette[index % chartPalette.length],
  );

export const barGroup = (point: DashboardSeriesPoint) => point.group ?? "Unassigned";
export const hasCoordinates = ({ x, y }: DashboardScatterPoint) => Number.isFinite(x) && Number.isFinite(y);
export const isRingSlice = ({ value }: DashboardSeriesPoint) => Number.isFinite(value) && value > 0;

export const barColorGroups = (series: DashboardSeriesPoint[]) =>
  series.some(({ group }) => group !== undefined) ? [...new Set(series.map(barGroup))] : [];

export const scatterColorGroups = (points: DashboardScatterPoint[]) => {
  const groups = new Set(points.filter(hasCoordinates).map(({ group }) => group));
  const keys = [...groups].filter((group) => group !== undefined).sort();
  let ungroupedLabel = "No group";
  for (let suffix = 2; groups.has(ungroupedLabel); suffix++) ungroupedLabel = `No group (${suffix})`;
  if (keys.length && groups.has(undefined)) keys.push(ungroupedLabel);
  return { keys, ungroupedLabel };
};

export const ringColorGroups = (series: DashboardSeriesPoint[]) =>
  [...new Set(series.filter(isRingSlice).map(({ label }) => label))].sort();

export const widgetColorSettings = (
  widget: DashboardWidget,
  source?: DashboardDataSource,
): DashboardColorSettings | undefined => {
  const series = source?.series ?? [];
  switch (widget.kind) {
    case "metric":
      return series.length ? { label: "Sparkline color" } : undefined;
    case "line":
      return { label: "Line color" };
    case "bar": {
      const keys = barColorGroups(series);
      return keys.length ? { label: "Series color", series: { label: "Series", keys } } : { label: "Bar color" };
    }
    case "scatter": {
      const { keys } = scatterColorGroups(source?.scatter?.points ?? []);
      return keys.length ? { label: "Cluster color", series: { label: "Cluster", keys } } : { label: "Point color" };
    }
    case "ring":
      return { label: "Slice color", series: { label: "Slice", keys: ringColorGroups(series) } };
    case "custom":
      return typeof source?.content === "function" ? source.colorSettings : undefined;
    case "table":
      return undefined;
  }
};
