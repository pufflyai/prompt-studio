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
import { type DashboardDataSource, type DashboardWidget, widgetLabel } from "./dashboard-types";

export function DashboardChart(props: { widget: DashboardWidget; source: DashboardDataSource; sparkline?: boolean }) {
  const { widget, source, sparkline } = props;
  const container = useRef<HTMLDivElement>(null);
  const sourceLabel = source.name;
  const number = new Intl.NumberFormat("en-US");
  const anchor: ChartTooltipAnchor = sparkline
    ? (_, { surface }) => {
        const bounds = container.current?.getBoundingClientRect();
        const card = container.current?.closest("[data-dashboard-widget-body]")?.getBoundingClientRect();
        if (!bounds || !card || !bounds.height) return { x: surface.width / 2, y: surface.height };
        return { x: surface.width / 2, y: ((card.bottom - bounds.top) / bounds.height) * surface.height };
      }
    : "point";
  const series = source.series ?? [];
  const points = Array.from(new Set(series.map((point) => point.label)), (label) => ({
    label,
    value: series.filter((point) => point.label === label).reduce((sum, point) => sum + point.value, 0),
  }));
  const stacked = widget.kind === "bar" && series.some((point) => point.group != null) && !sparkline;
  const mark = stacked
    ? barY(series, {
        x: "label",
        y: "value",
        color: "group",
        layout: stack(),
        radius: { end: chartGeometry.barRadius },
      })
    : lineY(points, { x: "label", y: "value", stroke: chartColor("vis.categorical.1") });
  const marks =
    widget.kind === "bar" && !stacked && !sparkline
      ? [
          barY(points, {
            x: "label",
            y: "value",
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
                  value: number.format(point.datum.value),
                  color: point.color,
                }));
                if (stacked)
                  rows.push({
                    label: `Total ${sourceLabel.toLowerCase()}`,
                    value: number.format(focused.reduce((sum, point) => sum + point.datum.value, 0)),
                    active: true,
                  });
                return { title: focused[0]?.datum.label, rows };
              },
            },
          },
        )}
      />
    </Box>
  );
}
