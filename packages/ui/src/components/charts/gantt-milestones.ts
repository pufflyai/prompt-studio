import { ganttGeometry } from "@/theme/primitives/gantt";
import type { GanttMilestone } from "./gantt-layout";

export function milestoneLabelLayout(
  milestones: readonly GanttMilestone[],
  domain: readonly [number, number],
  width: number,
  format: (value: number) => string,
  measure: (label: string) => number = (label) => label.length * 12,
) {
  const positions = new Map<number, GanttMilestone[]>();
  for (const milestone of milestones)
    positions.set(milestone.value, [...(positions.get(milestone.value) ?? []), milestone]);
  const lanes: { left: number; right: number }[][] = [];
  const labels = [...positions.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, markers]) => {
      const label = `${markers.map(({ label }) => label).join(", ")} · ${format(value)}`;
      const x = ((value - domain[0]) / (domain[1] - domain[0])) * width;
      const size = measure(label);
      const right = Math.min(width, Math.max(size, x - 4));
      const left = right - size;
      let level = lanes.findIndex((lane) => lane.every((other) => right + 8 < other.left || left > other.right + 8));
      if (level === -1) {
        level = lanes.length;
        lanes.push([]);
      }
      lanes[level].push({ left, right });
      return {
        id: markers.map(({ id }) => id).join(":"),
        value,
        label,
        dx: right - x,
        dy: -ganttGeometry.row / 2 - 12 - level * 20,
      };
    });
  return { labels, top: Math.max(ganttGeometry.top, lanes.length * 20 + 12) };
}
