import type { ToolExampleId } from "./tool-examples-content";

/** Panel widths per tool; switching tools animates between them like a mode change. */
export const RECORDING_LAYOUT: Record<
  ToolExampleId,
  { left: number; right: number; status: string; duration: number }
> = {
  board: { left: 200, right: 290, status: "Tool development", duration: 13500 },
  image: { left: 48, right: 240, status: "great-wave.png · 4 layers", duration: 7500 },
  canvas: { left: 190, right: 220, status: "components.canvas.tsx · 4 frames", duration: 7500 },
  icons: { left: 180, right: 230, status: "24 glyphs", duration: 7000 },
};

export const RECORDING_SIZE = { width: 1120, height: 600 };

const ICONS: Record<string, string> = {
  home: "M3 11l9-7 9 7v9H3z",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M16 16l5 5",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4",
  user: "M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21c1-4 4-6 8-6s7 2 8 6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  heart: "M12 20s-8-5-8-11a4 4 0 0 1 8-1a4 4 0 0 1 8 1c0 6-8 11-8 11z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  folder: "M3 6h6l2 2h10v11H3z",
  cloud: "M7 18a4 4 0 0 1 0-8a6 6 0 0 1 11 2a3 3 0 0 1 0 6z",
  bolt: "M13 2L5 14h6l-1 8 8-12h-6z",
  moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
  sun: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  plus: "M12 4v16M4 12h16",
  check: "M4 12l5 5L20 6",
  close: "M5 5l14 14M19 5L5 19",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  mail: "M3 6h18v12H3zM3 6l9 7 9-7",
  pin: "M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM12 8a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  tag: "M3 12V3h9l9 9-9 9z",
  shapes: "M4 4h7v7H4zM13 13h7v7h-7zM17 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
};

export const ICON_NAMES = Object.keys(ICONS);
export const iconSvg = (name: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name]}"/></svg>`;
