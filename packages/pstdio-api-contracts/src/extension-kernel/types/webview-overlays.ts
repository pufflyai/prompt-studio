/** Anchor bounds in the calling webview's viewport, in CSS pixels. */
export interface WebviewOverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WebviewOverlayAction {
  id: string;
  label: string;
  disabled?: boolean;
}

/** The host renders plain content with its own components; guests cannot supply HTML. */
export type WebviewOverlayContent =
  | { kind: "tooltip"; text: string }
  | { kind: "menu"; label: string; items: WebviewOverlayAction[] }
  | { kind: "popover"; title: string; text: string; actions?: WebviewOverlayAction[] };

export interface WebviewOverlayRequest {
  id: string;
  anchor: WebviewOverlayRect;
  content: WebviewOverlayContent;
  placement?: "top" | "right" | "bottom" | "left" | `${"top" | "right" | "bottom" | "left"}-${"start" | "end"}`;
}

export type WebviewOverlayParams =
  | ({ op: "show" } & WebviewOverlayRequest)
  | { op: "move"; id: string; anchor: WebviewOverlayRect }
  | { op: "close"; id: string };

export interface WebviewOverlayResult {
  /** Absent when dismissed, replaced, or the owning view closes. */
  actionId?: string;
}
