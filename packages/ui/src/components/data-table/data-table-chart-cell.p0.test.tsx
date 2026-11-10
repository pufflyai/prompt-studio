import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { DataTableChartCell } from "./data-table-chart-cell";
import { chartGeometry } from "./data-table-chart-geometry";

const markup = (value: unknown, type: "sparkline" | "bar-chart") =>
  renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <DataTableChartCell label="Duration" value={value} renderer={{ type, unit: "ms" }} />
    </ChakraProvider>,
  );

test("sparklines preserve missing measurements as separate line segments", () => {
  const value = { values: [10, 5, null, 8, 0] };
  const geometry = chartGeometry(value, { type: "sparkline" });
  expect(geometry.segments).toHaveLength(2);
  expect(geometry.points[2]).toBeNull();
  const html = markup(value, "sparkline");
  expect(html.match(/<polyline/g)).toHaveLength(2);
  expect(html).toContain("3: not measured");
  expect(html).toContain("5: 0 ms");
});

test("bar cells use a shared domain and keep signed values on their side of zero", () => {
  const geometry = chartGeometry({ values: [-10, 20, 0] }, { type: "bar-chart", domain: [-20, 20] });
  expect(geometry.points[0]!.start).toBeLessThan(geometry.zero);
  expect(geometry.points[1]!.start).toBe(geometry.zero);
  expect(geometry.points[2]!.width).toBe(0);
  const html = markup({ values: [10, 20], labels: ["Base", "Head"] }, "bar-chart");
  expect(html).toContain("Base: 10 ms");
  expect(html).toContain("Head: 20 ms");
});

test("single observations stay visible and entirely unmeasured charts show no data", () => {
  expect(markup({ values: [8] }, "sparkline")).toContain("<line");
  expect(markup({ values: [null, null] }, "sparkline")).toContain("No data");
  expect(markup({ values: [0, 0] }, "sparkline")).not.toContain("No data");
});

test("small nonzero measurements keep their precision in chart labels", () => {
  expect(markup({ values: [0.001], labels: ["Head"] }, "bar-chart")).toContain("Head: 0.001 ms");
});

test("explicit bar domains still include the zero baseline", () => {
  const geometry = chartGeometry({ values: [15, 20] }, { type: "bar-chart", domain: [10, 20] });
  expect(geometry.points[0]!.width / geometry.points[1]!.width).toBeCloseTo(0.75);
});
