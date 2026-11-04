// Carbon data visualization palettes, in their prescribed categorical order.
// https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes
export const chartCategorical = {
  light: [
    "#6929c4",
    "#1192e8",
    "#005d5d",
    "#9f1853",
    "#fa4d56",
    "#570408",
    "#198038",
    "#002d9c",
    "#ee538b",
    "#b28600",
    "#009d9a",
    "#012749",
    "#8a3800",
    "#a56eff",
  ],
  dark: [
    "#8a3ffc",
    "#33b1ff",
    "#007d79",
    "#ff7eb6",
    "#fa4d56",
    "#fff1f1",
    "#6fdc8c",
    "#4589ff",
    "#d12771",
    "#d2a106",
    "#08bdba",
    "#bae6ff",
    "#ba4e00",
    "#d4bbff",
  ],
} as const;

export const chartSequential = {
  blue: ["#d0e2ff", "#a6c8ff", "#78a9ff", "#4589ff", "#0f62fe", "#0043ce", "#002d9c"],
  purple: ["#e8daff", "#d4bbff", "#be95ff", "#a56eff", "#8a3ffc", "#6929c4", "#491d8b"],
  cyan: ["#bae6ff", "#82cfff", "#33b1ff", "#1192e8", "#0072c3", "#00539a", "#003a6d"],
  teal: ["#9ef0f0", "#3ddbd9", "#08bdba", "#009d9a", "#007d79", "#005d5d", "#004144"],
  red: ["#ffd7d9", "#ffb3b8", "#ff8389", "#fa4d56", "#da1e28", "#a2191f", "#750e13"],
} as const;

export const chartDiverging = {
  redCyan: [
    "#750e13",
    "#a2191f",
    "#da1e28",
    "#fa4d56",
    "#ff8389",
    "#ffb3b8",
    "#ffd7d9",
    "#fff1f1",
    "#e5f6ff",
    "#bae6ff",
    "#82cfff",
    "#33b1ff",
    "#1192e8",
    "#0072c3",
    "#00539a",
    "#003a6d",
  ],
  purpleTeal: [
    "#491d8b",
    "#6929c4",
    "#8a3ffc",
    "#a56eff",
    "#be95ff",
    "#d4bbff",
    "#e8daff",
    "#f6f2ff",
    "#d9fbfb",
    "#9ef0f0",
    "#3ddbd9",
    "#08bdba",
    "#009d9a",
    "#007d79",
    "#005d5d",
    "#004144",
  ],
} as const;

export const chartAlerts = {
  light: ["#da1e28", "#ff832b", "#f1c21b", "#198038"],
  dark: ["#fa4d56", "#ff832b", "#f1c21b", "#24a148"],
} as const;
