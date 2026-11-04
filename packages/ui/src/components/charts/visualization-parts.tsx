import { colorLegend, defineChart, waffleY } from "@tanstack/charts";
import { pie, polar, radialArc, radialText } from "@tanstack/charts/polar";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor, chartPalette } from "./chart";
import { parts } from "./visualization-data";
import { VisualizationExample as Example } from "./visualization-example";

const options = { keyboard: true, tooltip: { use: tooltip } };
function PartsChart({ variant = "pie" }: { variant?: "pie" | "donut" | "labeled" | "total" }) {
  const slices = pie(parts, { value: "value" });
  const donut = variant === "donut" || variant === "total";
  const labels = variant === "labeled";
  const center = variant === "total";
  const ariaLabel = { pie: "Pie", donut: "Donut", labeled: "Labeled pie", total: "Donut total" }[variant];
  const arcs = radialArc(slices, {
    innerRadius: ({ radius }) => (donut ? radius * 0.6 : 0),
    color: "name",
    key: "name",
  });
  const composition =
    labels || center
      ? polar({
          radiusRatio: labels ? 0.6 : 0.8,
          marks: [
            arcs,
            ...(labels
              ? [
                  radialText(slices, {
                    angle: "angle",
                    radius: 1.15,
                    text: (row) => `${row.name} ${Math.round(row.fraction * 100)}%`,
                    anchor: "outside",
                    fill: chartColor("vis.text.primary"),
                  }),
                ]
              : []),
            ...(center
              ? [
                  radialText([{ total: 100 }], {
                    angle: 0,
                    radius: 0,
                    text: "total",
                    fill: chartColor("vis.text.primary"),
                  }),
                ]
              : []),
          ],
          scales: {
            angle: { scale: scaleLinear().domain([0, Math.PI * 2]) },
            radius: { scale: scaleLinear().domain([0, 1]) },
          },
        })
      : polar({ radiusRatio: 0.8, marks: [arcs], scales: { angle: null, radius: null } });
  return (
    <Chart
      ariaLabel={ariaLabel}
      definition={defineChart(
        {
          marks: [composition],
          scales: { x: null, y: null },
          color: {
            domain: parts.map(({ name }) => name),
            range: chartPalette,
            legend: colorLegend({ placement: "bottom" }),
          },
        },
        options,
      )}
    />
  );
}
export function PieExamples() {
  return (
    <>
      <Example title="Pie">
        <PartsChart />
      </Example>
      <Example title="Donut">
        <PartsChart variant="donut" />
      </Example>
      <Example title="Labeled pie">
        <PartsChart variant="labeled" />
      </Example>
      <Example title="Donut total">
        <PartsChart variant="total" />
      </Example>
    </>
  );
}
export function PartsExamples() {
  return (
    <>
      <PieExamples />
      <Example title="Gauge">
        <Chart
          ariaLabel="Gauge"
          definition={defineChart(
            {
              marks: [
                polar({
                  radiusRatio: 0.8,
                  scales: {
                    angle: { scale: scaleLinear().domain([0, 1]) },
                    radius: { scale: scaleLinear().domain([0, 1]) },
                  },
                  marks: [
                    radialArc(
                      pie(
                        [
                          { name: "Complete", value: 72 },
                          { name: "Remaining", value: 28 },
                        ],
                        { value: "value", startAngle: -Math.PI * 0.75, endAngle: Math.PI * 0.75 },
                      ),
                      { innerRadius: ({ radius }) => radius * 0.75, color: "name" },
                    ),
                    radialText([{ value: 72 }], {
                      angle: 0,
                      radius: 0,
                      text: ({ value }) => `${value}%`,
                      fill: chartColor("vis.text.primary"),
                    }),
                  ],
                }),
              ],
              scales: { x: null, y: null },
              color: {
                domain: ["Complete", "Remaining"],
                range: [chartColor("vis.categorical.1"), chartColor("vis.grid")],
              },
            },
            options,
          )}
        />
      </Example>
      <Example title="Waffle">
        <Chart
          ariaLabel="Waffle"
          definition={defineChart(
            {
              color: { legend: colorLegend({ placement: "bottom" }) },
              marks: [waffleY(parts, { y: "value", color: "name", columns: 10, gap: 3 })],
              scales: { x: null, y: null },
            },
            options,
          )}
        />
      </Example>
    </>
  );
}
