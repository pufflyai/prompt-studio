import { Stack, Text } from "@chakra-ui/react";
import { barY, defineChart, dot, lineY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { chartGeometry } from "@/theme/primitives/chart";
import { DataTableStatChart } from "../data-table/data-table-stat-chart";
import { Chart } from "./chart";
import { GanttChart } from "./gantt-chart";
import { GanttDemo } from "./gantt-demo";

const values = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 12 },
  { day: "Wed", count: 5 },
];

export default {
  title: "Components/Charts",
  fullscreen: true,
  description:
    "Shared TanStack charts with semantic colors, tooltips, and keyboard focus. Compare light, dark, and custom themes.",
};
export const BarsAndLines = () => (
  <Stack gap="md" w="full" maxW="4xl">
    <Text textStyle="label/S/medium">Weekly activity</Text>
    <Chart
      ariaLabel="Tickets completed per day"
      height="xs"
      definition={defineChart(
        {
          marks: [barY(values, { radius: { end: chartGeometry.barRadius }, x: "day", y: "count" })],
          scales: { x: { scale: scaleBand }, y: { scale: scaleLinear, grid: true } },
        },
        { tooltip: { use: tooltip } },
      )}
    />
    <Chart
      ariaLabel="Activity trend"
      height="xs"
      definition={defineChart(
        {
          marks: [lineY(values, { x: "day", y: "count" }), dot(values, { x: "day", y: "count" })],
          scales: { x: { scale: scaleBand }, y: { scale: scaleLinear, grid: true } },
        },
        { tooltip: { use: tooltip } },
      )}
    />
  </Stack>
);
export const GanttDependencies = () => <GanttDemo />;
export const Statistics = () => (
  <Stack w="md" gap="md">
    {[25, 75].map((value) => (
      <DataTableStatChart
        key={value}
        data={[{ value }]}
        dataKey="value"
        color="vis.categorical.1"
        height="24px"
        ariaLabel={`${value}% share`}
        layout="vertical"
        domain={[0, 100]}
        tooltipLabel={() => "Share"}
        tooltipValue={(value) => `${value}%`}
        tooltipSeriesLabel="Value"
      />
    ))}
  </Stack>
);
export const EmptySchedule = () => <GanttChart tasks={[]} ariaLabel="Empty project schedule" />;
