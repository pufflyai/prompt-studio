import { defineChart, dot, link, text } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor } from "./chart";
import { edges, nodes } from "./visualization-data";
import { VisualizationExample as Example } from "./visualization-example";

const options = { keyboard: true, tooltip: { use: tooltip } };
export function NetworkExample() {
  return (
    <Example title="Network">
      <Chart
        ariaLabel="Network"
        definition={defineChart(
          {
            marks: [
              decorative(link(edges, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", stroke: chartColor("vis.grid") })),
              dot(nodes, { x: "x", y: "y", r: 8 }),
              decorative(text(nodes, { x: "x", y: "y", text: "id", dy: -18, fill: chartColor("vis.text.primary") })),
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
  );
}
