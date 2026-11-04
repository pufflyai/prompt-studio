import { areaY, colorLegend, defineChart, dot, lineY, ruleY, stack } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor } from "./chart";
import { activity, series } from "./visualization-data";
import { VisualizationExample as Example } from "./visualization-example";

const options = { keyboard: true, tooltip: { use: tooltip } };
const categorical = { x: { scale: scaleBand }, y: { scale: scaleLinear, grid: true } };
const numeric = {
  x: { scale: scaleLinear, axis: { ticks: { format: (value: number) => `${value}h` } } },
  y: { scale: scaleLinear, grid: true },
};
const legend = { legend: colorLegend({ placement: "bottom" }) };
const samples = activity.map((row, index) => ({ ...row, hour: index * 2 }));
const gaps = samples.map((row, index) => ({ ...row, value: index === 2 ? null : row.value }));
const targets = samples.map((row) => ({ ...row, value: row.value + 3 }));

export function AreaExamples() {
  return (
    <>
      <Example title="Stacked area">
        <Chart
          ariaLabel="Stacked area"
          definition={defineChart(
            {
              marks: [
                areaY(series, { x: "day", y: "value", z: "team", color: "team", fillOpacity: 1, layout: stack() }),
              ],
              scales: categorical,
              color: legend,
            },
            options,
          )}
        />
      </Example>
      <Example title="Proportional area">
        <Chart
          ariaLabel="Proportional area"
          definition={defineChart(
            {
              marks: [
                areaY(series, {
                  x: "day",
                  y: "value",
                  z: "team",
                  color: "team",
                  fillOpacity: 1,
                  layout: stack({ offset: "normalize" }),
                }),
              ],
              scales: {
                x: { scale: scaleBand },
                y: {
                  scale: scaleLinear().domain([0, 1]),
                  grid: true,
                  axis: { ticks: { format: (value: number) => `${Math.round(value * 100)}%` } },
                },
              },
              color: legend,
            },
            options,
          )}
        />
      </Example>
      <Example title="Overlapping areas">
        <Chart
          ariaLabel="Overlapping areas"
          definition={defineChart(
            {
              marks: [
                areaY(series, { x: "day", y1: 0, y2: "value", z: "team", color: "team", fillOpacity: 0.25 }),
                lineY(series, { x: "day", y: "value", z: "team", color: "team" }),
              ],
              scales: categorical,
              color: legend,
            },
            options,
          )}
        />
      </Example>
      <Example title="Streamgraph">
        <Chart
          ariaLabel="Streamgraph"
          definition={defineChart(
            {
              marks: [
                areaY(series, {
                  x: "day",
                  y: "value",
                  z: "team",
                  color: "team",
                  fillOpacity: 1,
                  layout: stack({ offset: "center" }),
                }),
              ],
              scales: categorical,
              color: legend,
            },
            options,
          )}
        />
      </Example>
    </>
  );
}

export function LineExamples() {
  return (
    <>
      <Example title="Line plot">
        <Chart
          ariaLabel="Line plot"
          definition={defineChart(
            {
              marks: [lineY(samples, { x: "hour", y: "value" }), dot(samples, { x: "hour", y: "value", r: 3 })],
              scales: numeric,
            },
            options,
          )}
        />
      </Example>
      <Example title="Actual and target">
        <Chart
          ariaLabel="Actual and target"
          definition={defineChart(
            {
              marks: [
                lineY(samples, { x: "hour", y: "value", color: () => "Actual" }),
                lineY(targets, { x: "hour", y: "value", color: () => "Target", strokeDasharray: "5 4" }),
              ],
              scales: numeric,
              color: legend,
            },
            options,
          )}
        />
      </Example>
      <Example title="Missing observations">
        <Chart
          ariaLabel="Missing observations"
          definition={defineChart(
            {
              marks: [lineY(gaps, { x: "hour", y: "value" }), dot(gaps, { x: "hour", y: "value", r: 3 })],
              scales: numeric,
            },
            options,
          )}
        />
      </Example>
      <Example title="Threshold">
        <Chart
          ariaLabel="Threshold"
          definition={defineChart(
            {
              marks: [
                lineY(samples, { x: "hour", y: "value" }),
                decorative(ruleY([12], { stroke: chartColor("vis.alert.seriousWarning"), strokeDasharray: "5 4" })),
              ],
              scales: numeric,
            },
            options,
          )}
        />
      </Example>
    </>
  );
}
