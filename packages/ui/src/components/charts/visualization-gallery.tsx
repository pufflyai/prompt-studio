import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import {
  areaY,
  barX,
  barY,
  binX,
  boxY,
  cell,
  colorLegend,
  defineChart,
  dot,
  group,
  lineY,
  link,
  rect,
  ruleY,
  stack,
  text,
} from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { chartGeometry } from "@/theme/primitives/chart";
import { ScrollArea } from "../primitives/scroll-area";
import { SimpleCard, SimpleCardBody } from "../primitives/simple-card";
import { Chart, chartColor } from "./chart";
import { GanttDemo } from "./gantt-demo";
import { activity, edges, matrix, nodes, observations, parts, series } from "./visualization-data";
import { VisualizationExample as Example } from "./visualization-example";
import { PartsExamples } from "./visualization-parts";
import { AreaExamples, LineExamples } from "./visualization-trends";

const options = { keyboard: true, tooltip: { use: tooltip } };
const xy = { x: { scale: scaleLinear }, y: { scale: scaleLinear, grid: true } };
const columns = { x: { scale: () => scaleBand().padding(0.2) }, y: { scale: scaleLinear, grid: true } };
const bins = binX(observations, { value: "value", thresholds: 8 });
const ramp = ["low-3", "low-2", "low-1", "default", "high-1"].map((value) =>
  chartColor(`vis.sequential.blue.${value}`),
);

export function VisualizationGallery() {
  return (
    <Stack h="3xl" w="full" gap="0" bg="bg" color="fg">
      <Text p="md" textStyle="heading/S/medium">
        Visualizations
      </Text>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md" minW="4xl">
          <SimpleGrid columns={2} gap="md">
            <Example title="Columns">
              <Chart
                ariaLabel="Columns"
                definition={defineChart(
                  {
                    marks: [barY(activity, { radius: chartGeometry.barRadius, x: "day", y: "value" })],
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Horizontal bars">
              <Chart
                ariaLabel="Horizontal bars"
                definition={defineChart(
                  {
                    marks: [barX(parts, { radius: chartGeometry.barRadius, x: "value", y: "name", color: "name" })],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: { x: { scale: scaleLinear, grid: true }, y: { scale: scaleBand } },
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Grouped bars">
              <Chart
                ariaLabel="Grouped bars"
                definition={defineChart(
                  {
                    marks: [
                      barY(series, {
                        radius: chartGeometry.barRadius,
                        x: "day",
                        y: "value",
                        z: "team",
                        color: "team",
                        layout: group(),
                      }),
                    ],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Stacked bars">
              <Chart
                ariaLabel="Stacked bars"
                definition={defineChart(
                  {
                    marks: [
                      barY(series, {
                        radius: chartGeometry.barRadius,
                        x: "day",
                        y: "value",
                        z: "team",
                        color: "team",
                        layout: stack(),
                      }),
                    ],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Lines">
              <Chart
                ariaLabel="Lines"
                definition={defineChart(
                  {
                    marks: [
                      lineY(series, { x: "day", y: "value", z: "team", color: "team" }),
                      dot(series, { x: "day", y: "value", color: "team" }),
                    ],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Area">
              <Chart
                ariaLabel="Area"
                definition={defineChart(
                  {
                    marks: [
                      areaY(activity, { x: "day", y: "value", fillOpacity: 0.25 }),
                      lineY(activity, { x: "day", y: "value" }),
                    ],
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Range">
              <Chart
                ariaLabel="Range"
                definition={defineChart(
                  {
                    marks: [
                      areaY(activity, { x: "day", y1: "low", y2: "high", fillOpacity: 0.2 }),
                      lineY(activity, { x: "day", y: "value" }),
                    ],
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Sparklines">
              <Chart
                ariaLabel="Sparklines"
                definition={defineChart(
                  {
                    marks: [
                      lineY(activity, { x: "day", y: "value" }),
                      dot(activity.slice(-1), { x: "day", y: "value", r: 4 }),
                    ],
                    scales: { x: { scale: scaleBand, axis: false }, y: { scale: scaleLinear, axis: false } },
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Scatter">
              <Chart
                ariaLabel="Scatter"
                definition={defineChart(
                  {
                    marks: [dot(observations, { x: "x", y: "value", color: "team", r: 4 })],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: xy,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Bubbles">
              <Chart
                ariaLabel="Bubbles"
                definition={defineChart(
                  {
                    marks: [
                      dot(observations.slice(0, 20), {
                        x: "x",
                        y: "value",
                        r: "size",
                        color: "team",
                        fillOpacity: 0.65,
                      }),
                    ],
                    color: { legend: colorLegend({ placement: "bottom" }) },
                    scales: xy,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Histogram">
              <Chart
                ariaLabel="Histogram"
                definition={defineChart(
                  {
                    marks: [
                      rect(bins, {
                        radius: chartGeometry.barRadius,
                        x1: "x1",
                        x2: "x2",
                        y1: () => 0,
                        y2: "value",
                        inset: 1,
                      }),
                    ],
                    scales: xy,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Box plot">
              <Chart
                ariaLabel="Box plot"
                definition={defineChart(
                  {
                    marks: [
                      boxY(observations, {
                        x: "team",
                        y: "value",
                        key: "id",
                        fill: chartColor("vis.categorical.1"),
                        fillOpacity: 0.25,
                        stroke: chartColor("vis.text.primary"),
                      }),
                    ],
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Heatmap">
              <Chart
                ariaLabel="Heatmap"
                definition={defineChart(
                  {
                    marks: [cell(matrix, { x: "day", y: "team", color: "score", inset: 2 })],
                    scales: { x: { scale: scaleBand }, y: { scale: scaleBand } },
                    color: { domain: [0, 1, 2, 3, 4], range: ramp, legend: colorLegend({ placement: "bottom" }) },
                  },
                  options,
                )}
              />
            </Example>
            <Example title="Range bars">
              <Chart
                ariaLabel="Range bars"
                definition={defineChart(
                  {
                    marks: [
                      barY(activity, { radius: chartGeometry.barRadius, x: "day", y1: "low", y2: "high" }),
                      decorative(ruleY([12], { stroke: chartColor("vis.text.secondary"), strokeDasharray: "4 4" })),
                    ],
                    scales: columns,
                  },
                  options,
                )}
              />
            </Example>
            <PartsExamples />
            <AreaExamples />
            <LineExamples />
            <Example title="Network">
              <Chart
                ariaLabel="Network"
                definition={defineChart(
                  {
                    marks: [
                      decorative(
                        link(edges, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", stroke: chartColor("vis.grid") }),
                      ),
                      dot(nodes, { x: "x", y: "y", r: 8 }),
                      decorative(
                        text(nodes, { x: "x", y: "y", text: "id", dy: -18, fill: chartColor("vis.text.primary") }),
                      ),
                    ],
                    scales: {
                      x: { scale: scaleLinear().domain([-0.5, 2.5]), axis: false },
                      y: { scale: scaleLinear().domain([0, 4]), axis: false },
                    },
                  },
                  options,
                )}
              />
            </Example>
          </SimpleGrid>
          <SimpleCard>
            <SimpleCardBody>
              <Stack gap="sm">
                <Text textStyle="label/M/medium">Gantt dependencies</Text>
                <GanttDemo />
              </Stack>
            </SimpleCardBody>
          </SimpleCard>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
