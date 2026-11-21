import { Chart, chartColor } from "@pstdio/ui/charts";
import { areaY, barX, barY, colorLegend, defineChart, lineY, rect, ruleX, stack } from "@tanstack/charts";
import { focusGroupX, focusNearestY } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { Condition } from "./fixtures";
import { ageLabel, healthIntervals, hoursFor, type Panel, type SeriesPoint, type WindowRange } from "./visual-data";

const legend = colorLegend({ placement: "bottom" });
const options = { keyboard: true, focus: focusGroupX, tooltip: { use: tooltip } };

export const HealthTimeline = ({ condition, range }: { condition: Condition; range: WindowRange }) => (
  <Chart
    ariaLabel="Health timeline for HTTP, access, sync, blob storage and live delivery"
    height="3xs"
    definition={defineChart(
      {
        marks: [rect(healthIntervals(condition, range), { x1: "start", x2: "end", y: "check", color: "state" })],
        scales: {
          x: { scale: scaleLinear().domain([-hoursFor(range), 0]), axis: { ticks: { format: ageLabel } } },
          y: { scale: scaleBand },
        },
        color: {
          domain: ["Healthy", "Failing", "Unknown"],
          range: [chartColor("vis.alert.success"), chartColor("vis.alert.danger"), chartColor("vis.grid")],
          legend,
        },
      },
      { keyboard: true, focus: focusNearestY, tooltip: { use: tooltip } },
    )}
  />
);

const CapacityChart = ({ points }: { points: SeriesPoint[] }) => (
  <Chart
    ariaLabel="Account, database, memory and probe capacity usage, percent"
    height="3xs"
    definition={defineChart(
      {
        marks: [
          barX(points, { x: "value", y: "series", color: "series" }),
          decorative(ruleX([80], { stroke: chartColor("vis.alert.seriousWarning"), strokeDasharray: "4 4" })),
        ],
        scales: {
          x: { scale: scaleLinear().domain([0, 100]), grid: true, axis: { label: "Used (%)" } },
          y: { scale: scaleBand },
        },
      },
      { keyboard: true, focus: focusNearestY, tooltip: { use: tooltip } },
    )}
  />
);

export const SeriesChart = ({ panel, points, range }: { panel: Panel; points: SeriesPoint[]; range: WindowRange }) => {
  if (panel.kind === "capacity") return <CapacityChart points={points} />;
  const mark =
    panel.kind === "area"
      ? areaY(points, { x: "time", y: "value", z: "series", color: "series", layout: stack(), fillOpacity: 0.7 })
      : lineY(points, { x: "time", y: "value", z: "series", color: "series" });
  return (
    <Chart
      ariaLabel={`${panel.title} in ${panel.unit}`}
      height="3xs"
      definition={defineChart(
        {
          marks:
            panel.kind === "bar" ? [barY(points, { x: "time", y: "value", color: "series", layout: stack() })] : [mark],
          scales: {
            x:
              panel.kind === "bar"
                ? { scale: scaleBand, axis: { ticks: { format: ageLabel } } }
                : { scale: scaleLinear().domain([-hoursFor(range), 0]), axis: { ticks: { format: ageLabel } } },
            y: { scale: scaleLinear, grid: true, axis: { label: panel.unit } },
          },
          color: { domain: [...new Set(points.map(({ series }) => series))], legend },
        },
        options,
      )}
    />
  );
};
