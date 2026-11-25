import { Text } from "@chakra-ui/react";
import { colorLegend, colorLegendItems, defineChart, dot } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart, chartColor } from "@/components/charts/chart";
import {
  dashboardGroupKey,
  hasCoordinates,
  resolveWidgetColor,
  scatterColorGroups,
  widgetColorRange,
} from "./dashboard-colors";
import { type DashboardDataSource, type DashboardWidget, widgetLabel } from "./dashboard-types";

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 17 });

export function DashboardScatterChart(props: { widget: DashboardWidget; scatter?: DashboardDataSource["scatter"] }) {
  const { widget, scatter } = props;
  const label = widgetLabel(widget);
  const { points = [], xLabel = "X", yLabel = "Y" } = scatter ?? {};
  const values = points.filter(hasCoordinates);
  if (!values.length)
    return (
      <Text color="fg.muted" textStyle="label/S/regular">
        No scatterplot data
      </Text>
    );
  const { keys: groups, names, ungroupedLabel } = scatterColorGroups(values);
  const color = resolveWidgetColor(widget.color) ?? chartColor("vis.categorical.1");
  return (
    <Chart
      ariaLabel={label}
      definition={defineChart(
        {
          marks: [
            dot(values, {
              x: "x",
              y: "y",
              r: 4,
              ...(groups.length ? { color: ({ group }) => dashboardGroupKey(group) } : { fill: color }),
            }),
          ],
          scales: {
            x: { scale: scaleLinear, nice: true, axis: { label: xLabel } },
            y: { scale: scaleLinear, nice: true, grid: true, axis: { label: yLabel } },
          },
          ...(groups.length
            ? {
                color: {
                  domain: groups,
                  range: widgetColorRange(widget, groups),
                  legend: colorLegend({
                    placement: "bottom",
                    items: colorLegendItems({ label: { format: (key) => names[String(key)] } }),
                  }),
                },
              }
            : {}),
        },
        {
          keyboard: true,
          tooltip: {
            use: tooltip,
            portal,
            content: ([point]) => {
              if (!point) return { rows: [] };
              const { x, y, label: name, group } = point.datum;
              return {
                title: name ?? label,
                rows: [
                  ...(groups.length ? [{ label: "Group", value: group ?? ungroupedLabel, color: point.color }] : []),
                  { label: xLabel, value: number.format(x) },
                  { label: yLabel, value: number.format(y) },
                ],
              };
            },
          },
        },
      )}
    />
  );
}
