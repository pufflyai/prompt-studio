import type { DataTableRendererChartOptions } from "@pstdio/sdk/extensions";
import type { DataTableChartValue } from "./types";

export const chartGeometry = (value: DataTableChartValue, renderer: DataTableRendererChartOptions) => {
  const present = value.values.filter((point): point is number => point !== null);
  const includeZero = renderer.type === "bar-chart";
  const lower = renderer.domain?.[0] ?? Math.min(...present);
  const upper = renderer.domain?.[1] ?? Math.max(...present);
  const low = includeZero ? Math.min(0, lower) : lower;
  const high = includeZero ? Math.max(0, upper) : upper;
  const inset = includeZero ? 0 : 4;
  const at = (point: number) =>
    low === high ? 50 : inset + Math.max(0, Math.min(1, (point - low) / (high - low))) * (100 - inset * 2);
  const points = value.values.map((point, index) =>
    point === null
      ? null
      : {
          value: point,
          label: value.labels?.[index] ?? String(index + 1),
          index,
          x: value.values.length === 1 ? 50 : 4 + (index / (value.values.length - 1)) * 92,
          y: 100 - at(point),
          start: Math.min(at(0), at(point)),
          width: Math.abs(at(point) - at(0)),
        },
  );
  const segments: string[] = [];
  let segment: string[] = [];
  for (const point of points) {
    if (point) segment.push(`${point.x},${point.y}`);
    else if (segment.length) {
      segments.push(segment.join(" "));
      segment = [];
    }
  }
  if (segment.length) segments.push(segment.join(" "));
  return { points, segments, zero: at(0) };
};
