import type { ThemePreferenceOption } from "@/utils/apply-theme-preference";
import { chartCategorical, chartSequential } from "../primitives/chart-palettes";

// A contributed theme can override chart tokens independently of UI accent colors.
export const chartForestTheme = {
  id: "charts-forest",
  title: "Charts Forest",
  mode: "dark",
  tokens: {
    "colors.bg": "#10251f",
    "colors.bg.subtle": "#17362d",
    "colors.fg": "#e8f5e9",
    "colors.fg.muted": "#acc9b8",
    "colors.border.subtle": "#3c5c4c",
    "colors.vis.text.primary": "#e8f5e9",
    "colors.vis.text.secondary": "#acc9b8",
    "colors.vis.axis": "#c4dfca",
    "colors.vis.grid": "#3c5c4c",
    // Carbon hues with lighter first/teal series for the contributed Forest surface.
    ...Object.fromEntries(chartCategorical.dark.map((color, index) => [`colors.vis.categorical.${index + 1}`, color])),
    "colors.vis.categorical.1": "#d4bbff",
    "colors.vis.categorical.3": "#08bdba",
    "colors.vis.categorical.11": "#007d79",
    "colors.vis.categorical.14": "#8a3ffc",
    ...Object.fromEntries(
      ["low-3", "low-2", "low-1", "default", "high-1", "high-2", "high-3"].map((step, index) => [
        `colors.vis.sequential.blue.${step}`,
        [...chartSequential.teal].reverse()[index],
      ]),
    ),
  },
} satisfies ThemePreferenceOption;
