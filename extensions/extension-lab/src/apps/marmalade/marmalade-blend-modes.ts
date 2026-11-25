import type { MarmaladeBlendMode } from "./marmalade.types";

export const marmaladeBlendModes: { id: MarmaladeBlendMode; name: string }[] = [
  { id: "normal", name: "Normal" },
  { id: "multiply", name: "Multiply" },
  { id: "screen", name: "Screen" },
  { id: "overlay", name: "Overlay" },
  { id: "darken", name: "Darken" },
  { id: "lighten", name: "Lighten" },
  { id: "color-dodge", name: "Color dodge (brighten the underlying colors)" },
  { id: "color-burn", name: "Color burn (darken the underlying colors)" },
  { id: "hard-light", name: "Hard light" },
  { id: "soft-light", name: "Soft light" },
  { id: "difference", name: "Difference" },
  { id: "exclusion", name: "Exclusion" },
  { id: "hue", name: "Hue" },
  { id: "saturation", name: "Saturation" },
  { id: "color", name: "Color" },
  { id: "luminosity", name: "Luminosity" },
];
