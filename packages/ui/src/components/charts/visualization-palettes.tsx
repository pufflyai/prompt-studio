import { barY, cell, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { chartGeometry } from "@/theme/primitives/chart";
import { Chart, chartColor, chartPalette } from "./chart";
import { VisualizationExample as Example } from "./visualization-example";

const options = { keyboard: true, tooltip: { use: tooltip } };
const categories = Array.from({ length: 14 }, (_, index) => ({ category: String(index + 1), value: 14 - index }));
const steps = ["low-3", "low-2", "low-1", "default", "high-1", "high-2", "high-3"];
function Ramp({ title, range }: { title: string; range: string[] }) {
  const rows = range.map((_, index) => ({ step: index, row: "Value", value: index }));
  return (
    <Example title={title}>
      <Chart
        ariaLabel={title}
        definition={defineChart(
          {
            marks: [cell(rows, { x: "step", y: "row", color: "value", inset: 1 })],
            scales: {
              x: {
                scale: scaleBand,
                axis: {
                  ticks: { format: (value: number) => ["Low", ...Array(range.length - 2).fill(""), "High"][value] },
                },
              },
              y: { scale: scaleBand, axis: false },
            },
            color: { domain: rows.map(({ value }) => value), range },
          },
          options,
        )}
      />
    </Example>
  );
}
export function PaletteExamples() {
  return (
    <>
      <Example title="Categorical palette">
        <Chart
          ariaLabel="Carbon categorical palette"
          definition={defineChart(
            {
              marks: [
                barY(categories, {
                  radius: { end: chartGeometry.barRadius },
                  x: "category",
                  y: "value",
                  color: "category",
                }),
              ],
              scales: { x: { scale: () => scaleBand().padding(0.2) }, y: { scale: scaleLinear, axis: false } },
              color: { domain: categories.map(({ category }) => category), range: chartPalette },
            },
            options,
          )}
        />
      </Example>
      {(["blue", "purple", "cyan", "teal", "red"] as const).map((name) => (
        <Ramp
          key={name}
          title={`${name[0].toUpperCase()}${name.slice(1)} intensity`}
          range={steps.map((step) => chartColor(`vis.sequential.${name}.${step}`))}
        />
      ))}
      {(["redCyan", "purpleTeal"] as const).map((name) => (
        <Ramp
          key={name}
          title={name === "redCyan" ? "Red–cyan divergence" : "Purple–teal divergence"}
          range={Array.from({ length: 16 }, (_, index) => chartColor(`vis.diverging.${name}.${index + 1}`))}
        />
      ))}
      <Example title="Alert palette">
        <Chart
          ariaLabel="Alert palette"
          definition={defineChart(
            {
              marks: [
                barY(
                  [
                    { status: "Danger", token: "danger", value: 4 },
                    { status: "Serious warning", token: "seriousWarning", value: 3 },
                    { status: "Warning", token: "warning", value: 2 },
                    { status: "Success", token: "success", value: 1 },
                  ],
                  {
                    radius: { end: chartGeometry.barRadius },
                    x: "status",
                    y: "value",
                    fill: (row) => chartColor(`vis.alert.${row.token}`),
                  },
                ),
              ],
              scales: { x: { scale: () => scaleBand().padding(0.2) }, y: { scale: scaleLinear, axis: false } },
            },
            options,
          )}
        />
      </Example>
    </>
  );
}
