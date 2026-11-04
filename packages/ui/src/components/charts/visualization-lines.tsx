import { areaY, colorLegend, crosshair, defineChart, dot, lineY, ruleX, ruleY } from "@tanstack/charts";
import { focusGroupX } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor } from "./chart";
import { VisualizationExample as Example } from "./visualization-example";
import { forecast, regionalTraffic, regions, rollingSeries, serviceMetrics, spikes } from "./visualization-line-data";

const options = { keyboard: true, focus: focusGroupX, tooltip: { use: tooltip } };
const legend = colorLegend({ placement: "bottom" });
const days = { scale: scaleLinear, axis: { label: "Day" } };
const cursor = () => crosshair({ y: false, stroke: chartColor("vis.axis"), strokeDasharray: "3 3" });

export function AdvancedLineExamples() {
  return (
    <>
      <Example title="Regional traffic">
        <Chart
          ariaLabel="Regional traffic"
          definition={defineChart(
            {
              marks: [lineY(regionalTraffic, { x: "day", y: "value", z: "region", color: "region" }), cursor()],
              scales: {
                x: days,
                y: {
                  scale: scaleLinear,
                  grid: true,
                  axis: { label: "Requests", ticks: { format: (value: number) => `${value / 1000}k` } },
                },
              },
              color: { domain: regions, legend },
            },
            options,
          )}
        />
      </Example>
      <Example title="Forecast intervals">
        <Chart
          ariaLabel="Forecast intervals"
          definition={defineChart(
            {
              marks: [
                decorative(
                  areaY(forecast.slice(59), {
                    x: "day",
                    y1: "lower95",
                    y2: "upper95",
                    color: () => "95% interval",
                    fillOpacity: 1,
                  }),
                ),
                decorative(
                  areaY(forecast.slice(59), {
                    x: "day",
                    y1: "lower80",
                    y2: "upper80",
                    color: () => "80% interval",
                    fillOpacity: 1,
                  }),
                ),
                lineY(forecast.slice(0, 60), { x: "day", y: "observed", color: () => "Observed" }),
                lineY(forecast.slice(59), { x: "day", y: "estimate", color: () => "Forecast", strokeDasharray: "5 4" }),
                decorative(ruleX([59], { stroke: chartColor("vis.axis"), strokeDasharray: "3 3" })),
                cursor(),
              ],
              scales: { x: days, y: { scale: scaleLinear, grid: true, axis: { label: "Demand" } } },
              color: {
                domain: ["Observed", "Forecast", "80% interval", "95% interval"],
                range: [
                  chartColor("vis.categorical.1"),
                  chartColor("vis.categorical.3"),
                  chartColor("vis.sequential.blue.low-1"),
                  chartColor("vis.sequential.blue.low-3"),
                ],
                legend,
              },
            },
            options,
          )}
        />
      </Example>
      <Example title="Spikes and rolling average">
        <Chart
          ariaLabel="Spikes and rolling average"
          definition={defineChart(
            {
              marks: [
                lineY(rollingSeries, { x: "day", y: "value", color: () => "Daily", strokeOpacity: 0.55 }),
                lineY(rollingSeries, { x: "day", y: "average", color: () => "7-day average", strokeWidth: 2 }),
                dot(spikes, { x: "day", y: "value", color: () => "Above 145", r: 4 }),
                decorative(ruleY([145], { stroke: chartColor("vis.alert.danger"), strokeDasharray: "3 3" })),
                cursor(),
              ],
              scales: { x: days, y: { scale: scaleLinear, grid: true, axis: { label: "Volume" } } },
              color: {
                domain: ["Daily", "7-day average", "Above 145"],
                range: [
                  chartColor("vis.categorical.2"),
                  chartColor("vis.categorical.1"),
                  chartColor("vis.alert.danger"),
                ],
                legend,
              },
            },
            options,
          )}
        />
      </Example>
      <Example title="CPU and latency">
        <Chart
          ariaLabel="CPU and latency"
          definition={defineChart(
            {
              marks: [
                lineY(serviceMetrics, { id: "cpu", x: "minute", y: "cpu", color: () => "CPU" }),
                lineY(serviceMetrics, {
                  id: "latency",
                  x: "minute",
                  y: "latency",
                  yScale: "latency",
                  color: () => "Latency",
                  strokeDasharray: "5 4",
                }),
                cursor(),
              ],
              scales: {
                x: { scale: scaleLinear, axis: { label: "Minute" } },
                y: { scale: scaleLinear().domain([0, 100]), grid: true, axis: { label: "CPU (%)" } },
                latency: {
                  channel: "y",
                  side: "right",
                  scale: scaleLinear().domain([0, 400]),
                  axis: { label: "Latency (ms)" },
                },
              },
              color: { domain: ["CPU", "Latency"], legend },
            },
            options,
          )}
        />
      </Example>
    </>
  );
}
