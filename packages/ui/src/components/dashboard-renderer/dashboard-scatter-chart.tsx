import { Text } from "@chakra-ui/react";
import { colorLegend, defineChart, dot } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@/components/charts/chart";
import type { DashboardDataSource } from "./dashboard-types";

const number = new Intl.NumberFormat();

export function DashboardScatterChart(props: { label: string; scatter?: DashboardDataSource["scatter"] }) {
  const { label, scatter } = props;
  const { points = [], xLabel = "X", yLabel = "Y" } = scatter ?? {};
  const values = points
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
    .map((point) => ({ ...point, colorGroup: point.group ?? "Unassigned" }));
  if (!values.length)
    return (
      <Text color="fg.muted" textStyle="label/S/regular">
        No scatterplot data
      </Text>
    );
  const grouped = values.some(({ group }) => group !== undefined);
  const groups = Array.from(new Set(values.map(({ colorGroup }) => colorGroup))).sort();
  return (
    <Chart
      ariaLabel={label}
      definition={defineChart(
        {
          marks: [dot(values, { x: "x", y: "y", color: "colorGroup", r: 4 })],
          scales: {
            x: { scale: scaleLinear, nice: true, axis: { label: xLabel } },
            y: { scale: scaleLinear, nice: true, grid: true, axis: { label: yLabel } },
          },
          ...(grouped ? { color: { domain: groups, legend: colorLegend({ placement: "bottom" }) } } : {}),
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
                  ...(group !== undefined ? [{ label: "Group", value: group, color: point.color }] : []),
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
