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

export const hasCoordinates = ({ x, y }: DashboardScatterPoint) => Number.isFinite(x) && Number.isFinite(y);
export const isRingSlice = ({ value }: DashboardSeriesPoint) => Number.isFinite(value) && value > 0;

export const dashboardGroupKey = (group?: string) => (group === undefined ? "ungrouped" : `group:${group}`);

function chartGroups(groups: (string | undefined)[], preferredLabel: string) {
  const named = new Set(groups);
  let ungroupedLabel = preferredLabel;
  for (let suffix = 2; named.has(ungroupedLabel); suffix++) ungroupedLabel = `${preferredLabel} (${suffix})`;
  const keys = groups.map(dashboardGroupKey);
  const names = Object.fromEntries(groups.map((group) => [dashboardGroupKey(group), group ?? ungroupedLabel]));
  return { keys, names, ungroupedLabel };
}

export const barColorGroups = (series: DashboardSeriesPoint[]) => {
  const groups = [...new Set(series.map(({ group }) => group))];
  return chartGroups(groups.some((group) => group !== undefined) ? groups : [], "Unassigned");
};

export const scatterColorGroups = (points: DashboardScatterPoint[]) => {
  const groups = new Set(points.filter(hasCoordinates).map(({ group }) => group));
  const sorted: (string | undefined)[] = [...groups].filter((group) => group !== undefined).sort();
  if (sorted.length && groups.has(undefined)) sorted.push(undefined);
  return chartGroups(sorted, "No group");
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
      const { keys, names } = barColorGroups(series);
      return keys.length ? { label: "Series color", series: { label: "Series", keys, names } } : { label: "Bar color" };
    }
    case "scatter": {
      const { keys, names } = scatterColorGroups(source?.scatter?.points ?? []);
      return keys.length
        ? { label: "Cluster color", series: { label: "Cluster", keys, names } }
        : { label: "Point color" };
    }
    case "ring":
      return { label: "Slice color", series: { label: "Slice", keys: ringColorGroups(series) } };
    case "custom":
      return typeof source?.content === "function" ? source.colorSettings : undefined;
    case "table":
      return undefined;
  }
};
