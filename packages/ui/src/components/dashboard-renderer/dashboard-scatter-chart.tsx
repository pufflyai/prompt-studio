import { Text } from "@chakra-ui/react";
import { colorLegend, colorLegendItems, defineChart, dot } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@/components/charts/chart";
import type { DashboardDataSource } from "./dashboard-types";

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 17 });
const ungrouped = 0;

export function DashboardScatterChart(props: { label: string; scatter?: DashboardDataSource["scatter"] }) {
  const { label, scatter } = props;
  const { points = [], xLabel = "X", yLabel = "Y" } = scatter ?? {};
  const values = points
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
    .map((point) => ({ ...point, colorGroup: point.group ?? ungrouped }));
  if (!values.length)
    return (
      <Text color="fg.muted" textStyle="label/S/regular">
        No scatterplot data
      </Text>
    );
  const keys = new Set(values.map(({ colorGroup }) => colorGroup));
  const groups = Array.from(keys)
    .filter((key) => typeof key === "string")
    .sort();
  const domain = keys.has(ungrouped) ? [...groups, ungrouped] : groups;
  let ungroupedLabel = "No group";
  for (let suffix = 2; keys.has(ungroupedLabel); suffix++) ungroupedLabel = `No group (${suffix})`;
  const legend = colorLegend({
    placement: "bottom",
    items: colorLegendItems({ label: { format: (key) => (key === ungrouped ? ungroupedLabel : String(key)) } }),
  });
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
          ...(groups.length ? { color: { domain, legend } } : {}),
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
