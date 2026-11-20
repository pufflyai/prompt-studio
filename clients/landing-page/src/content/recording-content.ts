import type { ToolExampleId } from "./tool-examples-content";

/** Panel widths per tool; switching tools animates between them like a mode change. */
export const RECORDING_LAYOUT: Record<
  ToolExampleId,
  { left: number; right: number; bottom: number; status: string; duration: number }
> = {
  board: { left: 200, right: 290, bottom: 0, status: "Tool development", duration: 13500 },
  image: { left: 48, right: 240, bottom: 0, status: "great-wave.png · 4 layers", duration: 7500 },
  canvas: { left: 190, right: 220, bottom: 0, status: "components.canvas.tsx · 4 frames", duration: 7500 },
  scene: { left: 180, right: 210, bottom: 110, status: "orbit.scene · 60 fps", duration: 6500 },
};

export const RECORDING_SIZE = { width: 1120, height: 560 };
