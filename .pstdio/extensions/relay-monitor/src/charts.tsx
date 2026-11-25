import { Chart, chartColor } from "@pstdio/ui/charts";
import { areaY, barX, barY, colorLegend, defineChart, lineY, rect, ruleX, stack } from "@tanstack/charts";
import { focusGroupX, focusNearestY } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { Interval, Panel } from "./model";

const legend = colorLegend({ placement: "bottom" });
const time = (seconds: number) => new Date(seconds * 1000).toISOString().slice(5, 16).replace("T", " ");
export const HealthTimeline = ({ intervals, domain }: { intervals: Interval[]; domain: [number, number] }) => (
  <Chart
    ariaLabel="Health over time for HTTP, access, sync, blob integrity and live delivery, UTC"
    height="3xs"
    definition={defineChart(
      {
        marks: [rect(intervals, { x1: "start", x2: "end", y: "check", color: "state" })],
        scales: {
          x: { scale: scaleLinear().domain(domain), axis: { ticks: { format: time } } },
          y: { scale: scaleBand },
        },
        color: {
          domain: ["Healthy", "Warning", "Failing", "Unknown"],
          range: [
            chartColor("vis.alert.success"),
            chartColor("vis.alert.seriousWarning"),
            chartColor("vis.alert.danger"),
            chartColor("vis.grid"),
          ],
          legend,
        },
      },
      { keyboard: true, focus: focusNearestY, tooltip: { use: tooltip } },
    )}
  />
);
export const SeriesChart = ({ panel, domain }: { panel: Panel; domain: [number, number] }) => {
  const segments = new Map<string, number>();
  const points = panel.points.flatMap((point) => {
    const segment = segments.get(point.series) ?? 0;
    if (point.value === null) {
      segments.set(point.series, segment + 1);
      return [];
    }
    return [{ ...point, value: point.value, segment: `${point.series}:${segment}` }];
  });
  if (panel.kind === "capacity")
    return (
      <Chart
        ariaLabel={`${panel.title}, used percent`}
        height="3xs"
        definition={defineChart(
          {
            marks: [
              barX(points, { x: "value", y: "series", color: "series" }),
              decorative(ruleX([80], { stroke: chartColor("vis.alert.seriousWarning"), strokeDasharray: "4 4" })),
            ],
            scales: {
              x: {
                scale: scaleLinear().domain([0, Math.max(100, ...points.map(({ value }) => value))]),
                grid: true,
                axis: { label: "Used (%)" },
              },
              y: { scale: scaleBand },
            },
          },
          { keyboard: true, focus: focusNearestY, tooltip: { use: tooltip } },
        )}
      />
    );
  const mark =
    panel.kind === "area"
      ? areaY(points, { x: "time", y: "value", z: "segment", color: "series", layout: stack(), fillOpacity: 0.7 })
      : lineY(points, { x: "time", y: "value", z: "segment", color: "series" });
  return (
    <Chart
      ariaLabel={`${panel.title}, ${panel.unit}, UTC`}
      height="3xs"
      definition={defineChart(
        {
          marks:
            panel.kind === "bar" ? [barY(points, { x: "time", y: "value", color: "series", layout: stack() })] : [mark],
          scales: {
            x:
              panel.kind === "bar"
                ? { scale: scaleBand, axis: { ticks: { format: time } } }
                : { scale: scaleLinear().domain(domain), axis: { ticks: { format: time } } },
            y: { scale: scaleLinear, grid: true, axis: { label: panel.unit } },
          },
          color: { domain: [...new Set(points.map(({ series }) => series))], legend },
        },
        { keyboard: true, focus: focusGroupX, tooltip: { use: tooltip } },
      )}
    />
  );
};
