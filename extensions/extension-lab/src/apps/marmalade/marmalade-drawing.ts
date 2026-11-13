import type { MarmaladeTool } from "./marmalade.types";

export interface MarmaladeDrawing {
  tool: Extract<MarmaladeTool, "rectangle" | "ellipse" | "brush">;
  points: [number, number][];
}
export const marmaladeDrawingAction = (drawing: MarmaladeDrawing) => {
  const xs = drawing.points.map((point) => point[0]);
  const ys = drawing.points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    type: "create" as const,
    kind: drawing.tool,
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    ...(drawing.tool === "brush"
      ? { points: drawing.points.map((point): [number, number] => [point[0] - x, point[1] - y]) }
      : {}),
  };
};
