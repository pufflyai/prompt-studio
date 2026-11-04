import { Box, useSlotRecipe } from "@chakra-ui/react";
import { defineChart, dot, link, rect, ruleX, text } from "@tanstack/charts";
import { focusNearestY } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ComponentType, CSSProperties } from "react";
import { EmptyState } from "@/components/primitives/empty-state";
import { ganttGeometry } from "@/theme/primitives/gantt";
import psTheme from "@/theme/theme";
import { Chart, chartColor, chartPalette } from "./chart";
import { type GanttMilestone, type GanttTask, ganttLayout } from "./gantt-layout";
import { milestoneLabelLayout } from "./gantt-milestones";
import { dependencyRoute } from "./gantt-route";
import { useChartWidth } from "./use-chart-width";

export interface GanttChartProps {
  tasks: readonly GanttTask[];
  ariaLabel: string;
  milestones?: readonly GanttMilestone[];
  /** Optional application badges; the title action remains accessible independently. */
  TaskBadges?: ComponentType<{ task: GanttTask }>;
  onOpen?: (id: string) => void;
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
  const {
    tasks,
    milestones = [],
    ariaLabel,
    formatValue = String,
    now,
    selectedId,
    onSelect,
    onOpen,
    TaskBadges,
  } = props;
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("chart") })();
  const plot = useChartWidth();
  const layout = ganttLayout(tasks);
  if (!layout.rows.length) return <EmptyState title="No scheduled work" />;
  const groups = [...new Set(tasks.map((task) => task.group ?? ""))];
  const starts = tasks.map((task) => task.start);
  const ends = tasks.map((task) => task.end);
  const first = Math.min(...starts, ...milestones.map(({ value }) => value), now ?? Infinity);
  const last = Math.max(...ends, ...milestones.map(({ value }) => value), now ?? -Infinity);
  const padding = Math.max((last - first) * 0.04, 0.25);
  const labelLayout = milestoneLabelLayout(
    milestones,
    [first - padding, last + padding],
    Math.max(1, plot.width - ganttGeometry.left - ganttGeometry.right),
    formatValue,
    plot.measureLabel,
  );
  const work = layout.rows.filter((row) => row.kind === "task");
  const instant = layout.rows.filter((row) => row.kind === "milestone");
  const progress = work
    .filter((row) => row.progress > 0)
    .map((row) => ({
      ...row,
      end: row.start + (row.end - row.start) * row.progress,
    }));
  const definition = defineChart(
    ({ width }) => ({
      marks: [
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
        decorative(
          link(layout.dependencies, {
            x1: "from",
            x2: "to",
            y1: "fromLane",
            y2: "toLane",
            stroke: chartColor("vis.text.secondary"),
            strokeOpacity: 0.35,
            curve: dependencyRoute,
          }),
        ),
        dot(instant, {
          id: "milestones",
          key: "lane",
          x: "start",
          y: "lane",
          color: (row) => row.group ?? "",
          r: 5,
        }),
        decorative(
          ruleX(labelLayout.labels, {
            id: "milestone-lines",
            x: "value",
            stroke: chartColor("vis.axis"),
            strokeDasharray: "3 3",
          }),
        ),
        decorative(
          text(labelLayout.labels, {
            id: "milestone-labels",
            x: "value",
            y: () => layout.rows[0].lane,
            text: "label",
            dy: (label) => label.dy,
            anchor: "end",
            dx: (label) => label.dx,
            fill: chartColor("vis.text.primary"),
          }),
        ),
        ...(now === undefined
          ? []
          : [decorative(ruleX([now], { stroke: chartColor("vis.axis"), strokeDasharray: "4 4" }))]),
      ],
      color: { domain: groups, range: chartPalette },
      scales: {
        x: {
          scale: scaleLinear().domain([first - padding, last + padding]),
          grid: true,
          axis: {
            ticks: {
              count: Math.max(3, Math.floor(width / 120)),
              format: (value: number) => (value === now ? "Now" : formatValue(value)),
            },
          },
        },
        y: {
          scale: scaleBand<string>()
            .domain(layout.rows.map((row) => row.lane))
            .paddingInner(0.5)
            .paddingOuter(0.25),
          axis: false,
        },
      },
      margin: {
        left: ganttGeometry.left,
        right: ganttGeometry.right,
        top: labelLayout.top,
        bottom: ganttGeometry.bottom,
      },
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
    <Box css={styles.gantt} data-gantt style={{ "--gantt-top": `${labelLayout.top}px` } as CSSProperties}>
      <Box css={styles.tickets} role="list" aria-label="Scheduled tickets">
        {tasks.map((task) => (
          <Box
            key={task.id}
            css={styles.ticket}
            role="listitem"
            data-ticket-id={task.id}
            data-selected={task.id === selectedId}
          >
            <Box
              as="button"
              css={styles.ticketTitle}
              onClick={() => (onOpen ?? onSelect)?.(task.id)}
              aria-label={`${onOpen ? "Open" : "Select"} ${task.label}`}
            >
              {task.label}
            </Box>
            {TaskBadges ? <TaskBadges task={task} /> : null}
          </Box>
        ))}
      </Box>
      <Box css={styles.plot} ref={plot.ref}>
        <Chart
          ariaLabel={ariaLabel}
          definition={definition}
          height={layout.rows.length * ganttGeometry.row + labelLayout.top + ganttGeometry.bottom}
          onSelect={(point) => {
            if (point) onSelect?.(point.datum.id);
          }}
        />
      </Box>
    </Box>
  );
}
