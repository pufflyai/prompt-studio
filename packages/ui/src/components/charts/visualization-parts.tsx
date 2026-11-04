import { colorLegend, defineChart, waffleY } from "@tanstack/charts";
import { pie, polar, radialArc, radialText } from "@tanstack/charts/polar";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart, chartColor, chartPalette } from "./chart";
import { parts } from "./visualization-data";
import { VisualizationExample as Example } from "./visualization-example";

const options = { keyboard: true, tooltip: { use: tooltip } };
function PartsChart({ donut = false }: { donut?: boolean }) {
  return (
    <Chart
      ariaLabel={donut ? "Donut" : "Pie"}
      definition={defineChart(
        {
          marks: [
            polar({
              radiusRatio: 0.8,
              marks: [
                radialArc(pie(parts, { value: "value" }), {
                  innerRadius: ({ radius }) => (donut ? radius * 0.6 : 0),
                  color: "name",
                  key: "name",
                }),
              ],
              scales: { angle: null, radius: null },
            }),
          ],
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
export function PartsExamples() {
  return (
    <>
      <Example title="Pie">
        <PartsChart />
      </Example>
      <Example title="Donut">
        <PartsChart donut />
      </Example>
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
