import { expect, test } from "bun:test";
import { chartCategorical } from "../primitives/chart-palettes";
import { chartForestTheme } from "./chart-theme.canvas-fixture";

// Categories must remain distinguishable when a contributed theme changes their palette.
test("light, dark, and Forest preserve fourteen distinct categorical colors", () => {
  const overrides: Record<string, string> = chartForestTheme.tokens;
  const forest = chartCategorical.dark.map((color, index) => overrides[`colors.vis.categorical.${index + 1}`] ?? color);
  for (const palette of [chartCategorical.light, chartCategorical.dark, forest]) {
    expect(palette).toHaveLength(14);
    expect(new Set(palette).size).toBe(14);
  }
});
