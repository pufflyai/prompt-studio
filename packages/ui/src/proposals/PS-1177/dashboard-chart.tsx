import { barY, colorLegend, defineChart, lineY, stack } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor } from "@/components/charts/chart";
import { chartGeometry } from "@/theme/primitives/chart";
import { activity, type DashboardWidget, trends, widgetLabel } from "./dashboard-fixtures";

export function DashboardChart(props: { widget: DashboardWidget; days: number; sparkline?: boolean }) {
  const { widget, days, sparkline } = props;
  const points = trends[widget.source]
    .slice(-days)
    .map((count, index) => ({ day: `Nov ${13 - Math.min(days, 7) + index}`, count }));
  const stacked = widget.kind === "bar" && widget.source === "conversations" && !sparkline;
  const mark = stacked
    ? barY(activity.slice(-days * 3), {
        x: "day",
        y: "count",
        color: "agent",
        layout: stack(),
        radius: { end: chartGeometry.barRadius },
      })
    : lineY(points, { x: "day", y: "count", stroke: chartColor("vis.categorical.1") });
  const marks =
    widget.kind === "bar" && !stacked && !sparkline
      ? [
          barY(points, {
            x: "day",
            y: "count",
            fill: chartColor("vis.categorical.1"),
            radius: { end: chartGeometry.barRadius },
          }),
        ]
      : [mark];
  return (
    <Chart
      ariaLabel={`${widgetLabel(widget)}${sparkline ? " trend" : ""}`}
      definition={defineChart(
        {
          marks,
          guides: !sparkline,
          ...(sparkline ? { margin: 0 } : {}),
          scales: { x: { scale: scaleBand }, y: { scale: scaleLinear, grid: !sparkline } },
          ...(stacked ? { color: { legend: colorLegend({ placement: "bottom" }) } } : {}),
        },
        { keyboard: !sparkline, tooltip: { use: tooltip } },
      )}
    />
  );
}
