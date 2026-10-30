import type { CanvasRuntime } from "../controller/runtime";
import type { FrameMessage } from "./protocol";

export const navigateFrame = (message: FrameMessage, id: string, runtime: CanvasRuntime) => {
  if (runtime.selection.get() !== id) return;
  const delta = { x: message.deltaX ?? 0, y: message.deltaY ?? 0 };
  if (message.type === "pan") runtime.pan(delta);
  if (message.type === "reveal" && message.id) runtime.reveal(message.id);
  if (message.type !== "wheel" && message.type !== "focus") return;
  const anchor = runtime.frameAnchor(id, { x: message.x ?? 0, y: message.y ?? 0 });
  if (message.type === "focus") {
    const zoom = runtime.get().camera.zoom;
    runtime.revealRegion({ ...anchor, width: (message.width ?? 0) * zoom, height: (message.height ?? 0) * zoom });
    return;
  }
  if (message.zoom) runtime.zoom(Math.exp(-delta.y / 333), anchor);
  else runtime.pan({ x: -delta.x, y: -delta.y });
};
