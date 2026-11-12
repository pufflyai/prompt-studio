import { Box } from "@chakra-ui/react";
import {
  barY,
  type ChartTooltipAnchor,
  type ChartTooltipRow,
  colorLegend,
  defineChart,
  lineY,
  stack,
} from "@tanstack/charts";
import { focusGroupX } from "@tanstack/charts/focus";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { useRef } from "react";
import { Chart, chartColor } from "@/components/charts/chart";
import { chartGeometry } from "@/theme/primitives/chart";
import { activity, type DashboardWidget, sources, trends, widgetLabel } from "./dashboard-fixtures";

export function DashboardChart(props: { widget: DashboardWidget; days: number; sparkline?: boolean }) {
  const { widget, days, sparkline } = props;
  const container = useRef<HTMLDivElement>(null);
  const sourceLabel = sources.find(({ id }) => id === widget.source)?.name ?? widget.source;
  const number = new Intl.NumberFormat("en-US");
  const anchor: ChartTooltipAnchor = sparkline
    ? (_, { surface }) => {
        const bounds = container.current?.getBoundingClientRect();
        const card = container.current?.closest("[data-dashboard-widget-body]")?.getBoundingClientRect();
        if (!bounds || !card || !bounds.height) return { x: surface.width / 2, y: surface.height };
        return { x: surface.width / 2, y: ((card.bottom - bounds.top) / bounds.height) * surface.height };
      }
    : "point";
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
    <Box ref={container} h="full" minH="0">
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
          {
            keyboard: !sparkline,
            focus: focusGroupX,
            tooltip: {
              use: tooltip,
              portal,
              anchor,
              placement: sparkline ? "bottom" : "auto",
              sort: "color-domain",
              content: (focused) => {
                const rows: ChartTooltipRow[] = focused.map((point) => ({
                  label: point.group == null ? sourceLabel : String(point.group),
                  value: number.format(point.datum.count),
                  color: point.color,
                }));
                if (stacked)
                  rows.push({
                    label: "Total conversations",
                    value: number.format(focused.reduce((sum, point) => sum + point.datum.count, 0)),
                    active: true,
                  });
                return { title: focused[0]?.datum.day, rows };
              },
            },
          },
        )}
      />
    </Box>
  );
}
