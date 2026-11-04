import type { ThemePreferenceOption } from "@/utils/apply-theme-preference";

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
    "colors.vis.categorical.1": "#8cdb91",
    "colors.vis.categorical.2": "#efcb79",
    "colors.vis.categorical.3": "#b9b1f5",
    "colors.vis.categorical.4": "#f49a90",
    "colors.vis.categorical.5": "#e8a8cf",
    "colors.vis.categorical.6": "#79cdd2",
    "colors.vis.categorical.7": "#b9d87b",
    "colors.vis.sequential.blue.low-3": "#234534",
    "colors.vis.sequential.blue.low-2": "#356847",
    "colors.vis.sequential.blue.low-1": "#4a8c5d",
    "colors.vis.sequential.blue.default": "#70b879",
    "colors.vis.sequential.blue.high-1": "#a0d99b",
  },
} satisfies ThemePreferenceOption;
