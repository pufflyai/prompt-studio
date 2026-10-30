// The messages between a UI Canvas frame and its host. They match the protocol the UI Canvas
// extension speaks; the extension reads these types from this package once it adopts it.
export const frameProtocol = "pstdio.canvas.preview";

export interface FrameTheme {
  id: string;
  mode: "light" | "dark";
}

export interface FrameItem {
  preview?: { source: string; exportName: string; viewportHeight?: number };
}

export interface FrameRequest {
  protocol: typeof frameProtocol;
  nonce: string;
  type: "render" | "theme" | "bootstrap" | "assets";
  requestId?: string;
  error?: string;
  item?: FrameItem;
  theme?: FrameTheme;
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
  information?: { args?: string; description?: string };
}
