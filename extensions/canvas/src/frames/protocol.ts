import type { ThemePreferenceOption } from "@pstdio/ui";
import type { CanvasItem } from "../canvases/definitions";
export const frameProtocol = "pstdio.canvas.preview";
export interface FrameRequest {
  protocol: typeof frameProtocol;
  nonce: string;
  type: "render" | "theme" | "bootstrap" | "assets";
  requestId?: string;
  error?: string;
  item?: CanvasItem;
  theme?: ThemePreferenceOption;
  bootstrap?: import("./assets").FrameBootstrap;
}
export interface FrameMessage {
  protocol: typeof frameProtocol;
  type:
    | "bootstrap"
    | "boot"
    | "height"
    | "loaded"
    | "error"
    | "wheel"
    | "pan"
    | "reveal"
    | "focus"
    | "assets"
    | "imports-ready"
    | "painted";
  requestId?: string;
  source?: string;
  timings?: Record<string, number>;
  nonce?: string;
  height?: number;
  width?: number;
  message?: string;
  id?: string;
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
  zoom?: boolean;
  information?: { args?: string; argTypes?: string; description?: string };
}
