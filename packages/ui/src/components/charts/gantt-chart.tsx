import { defineChart, dot, link, rect, ruleX } from "@tanstack/charts";
import { focusNearestY } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { EmptyState } from "@/components/primitives/empty-state";
import { Chart, chartColor, chartPalette } from "./chart";
import { type GanttTask, ganttLayout } from "./gantt-layout";
import { dependencyRoute } from "./gantt-route";

export interface GanttChartProps {
  tasks: readonly GanttTask[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
  now?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const laneFocus = {
  ...focusNearestY,
  navigation: <T extends { x: number; y: number }>(points: readonly T[]) =>
    [...points].sort((left, right) => left.y - right.y || left.x - right.x),
};

// Composition follows TanStack's Gantt Dependencies catalog example:
// https://tanstack.com/charts/catalog/charts/198-gantt-dependencies
export function GanttChart(props: GanttChartProps) {
  const { tasks, ariaLabel, formatValue = String, now, selectedId, onSelect } = props;
  const layout = ganttLayout(tasks);
  if (!layout.rows.length) return <EmptyState title="No scheduled work" />;
  const labels = new Map(layout.rows.map((row) => [row.lane, row.label]));
  const groups = [...new Set(tasks.map((task) => task.group ?? ""))];
  const starts = tasks.map((task) => task.start);
  const ends = tasks.map((task) => task.end);
  const first = Math.min(...starts, now ?? Infinity);
  const last = Math.max(...ends, now ?? -Infinity);
  const padding = Math.max((last - first) * 0.04, 0.25);
  const summaries = layout.rows.filter((row) => row.kind === "group");
  const work = layout.rows.filter((row) => row.kind === "task");
  const milestones = layout.rows.filter((row) => row.kind === "milestone");
  const progress = work
    .filter((row) => row.progress > 0)
    .map((row) => ({
      ...row,
      end: row.start + (row.end - row.start) * row.progress,
    }));
  const definition = defineChart(
    ({ width }) => ({
      marks: [
        decorative(
          rect(summaries, {
            x1: () => first - padding,
            x2: () => last + padding,
            y: "lane",
            fill: chartColor("bg.subtle"),
          }),
        ),
        rect(work, {
          id: "tasks",
          key: "lane",
          x1: "start",
          x2: "end",
          y: "lane",
          color: (row) => row.group ?? "",
          fillOpacity: 0.4,
          radius: 2,
        }),
        decorative(
          rect(progress, {
            key: "lane",
            x1: "start",
            x2: "end",
            y: "lane",
            color: (row) => row.group ?? "",
            radius: 2,
          }),
        ),
        decorative(
          rect(
            work.filter((row) => row.id === selectedId),
            {
              x1: "start",
              x2: "end",
              y: "lane",
              fill: "none",
              stroke: chartColor("fg.accent"),
              strokeWidth: 2,
              radius: 2,
            },
          ),
        ),
        rect(summaries, {
          id: "groups",
          key: "lane",
          x1: "start",
          x2: "end",
          y: "lane",
          fill: chartColor("vis.axis"),
          fillOpacity: 0.15,
          stroke: chartColor("vis.axis"),
          radius: 2,
        }),
        decorative(
          link(layout.dependencies, {
            x1: "from",
            x2: "to",
            y1: "fromLane",
            y2: "toLane",
            stroke: chartColor("vis.text.secondary"),
            strokeOpacity: 0.65,
            curve: dependencyRoute,
          }),
        ),
        dot(milestones, {
          id: "milestones",
          key: "lane",
          x: "start",
          y: "lane",
          color: (row) => row.group ?? "",
          r: 5,
        }),
        ...(now === undefined
          ? []
          : [decorative(ruleX([now], { stroke: chartColor("vis.axis"), strokeDasharray: "4 4" }))]),
      ],
      color: { domain: groups, range: chartPalette },
      scales: {
        x: {
          scale: scaleLinear().domain([first - padding, last + padding]),
          grid: true,
          axis: { ticks: { count: Math.max(3, Math.floor(width / 120)), format: formatValue } },
        },
        y: {
          scale: scaleBand<string>()
            .domain(layout.rows.map((row) => row.lane))
            .padding(0.4),
          axis: { line: false, ticks: { size: 0, format: (id: string) => labels.get(id) ?? id } },
        },
      },
      margin: { left: Math.min(260, width * 0.38), top: 16, bottom: 32 },
    }),
    {
      focus: laneFocus,
      keyboard: true,
      tooltip: {
        use: tooltip,
        format: ({ datum }) =>
          `${datum.label}: ${formatValue(datum.start)} – ${formatValue(datum.end)} · ${Math.round(datum.progress * 100)}% complete`,
      },
    },
  );
  return (
    <Chart
      ariaLabel={ariaLabel}
      definition={definition}
      height={Math.max(280, layout.rows.length * 44 + 48)}
      onSelect={(point) => {
        if (point && point.datum.kind !== "group") onSelect?.(point.datum.id);
      }}
    />
  );
}
