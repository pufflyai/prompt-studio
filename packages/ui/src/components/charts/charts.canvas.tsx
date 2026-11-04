import { Stack, Text } from "@chakra-ui/react";
import { barY, defineChart, dot, lineY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useState } from "react";
import { DataTableStatChart } from "../data-table/data-table-stat-chart";
import { Chart } from "./chart";
import { GanttChart } from "./gantt-chart";

const values = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 12 },
  { day: "Wed", count: 5 },
];
const tasks = [
  { id: "schema", label: "Define project structure", group: "Foundation · ETA ~7h", start: 0, end: 4, progress: 1 },
  {
    id: "nav",
    label: "Build project navigation",
    group: "Foundation · ETA ~7h",
    start: 4,
    end: 7,
    progress: 0.3,
    dependsOn: ["schema"],
  },
  { id: "preview", label: "Review working preview", group: "Preview · ETA ~9h", start: 7, end: 9, dependsOn: ["nav"] },
  { id: "release", label: "Release milestone", group: "Preview · ETA ~9h", start: 9, end: 9, dependsOn: ["preview"] },
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
          marks: [barY(values, { x: "day", y: "count" })],
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
export const GanttDependencies = () => {
  const [selectedId, setSelectedId] = useState<string>();
  return (
    <Stack w="full">
      <GanttChart
        tasks={tasks}
        ariaLabel="Project forecast with dependencies"
        formatValue={(value) => `${value}h`}
        now={0}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <Text role="status" textStyle="label/XS/regular">
        {selectedId ? `Selected ${selectedId}` : "Select a task"}
      </Text>
    </Stack>
  );
};
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
