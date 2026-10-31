import type { WebviewOverlayRect, WebviewOverlayRequest } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./define-extension-view";

export const createWebviewOverlaysClient = (host: GuestHost) => ({
  /** Resolves when an action is selected or the overlay closes. */
  show: (request: WebviewOverlayRequest) => host.call("overlays", { op: "show", ...request }),
  move: (id: string, anchor: WebviewOverlayRect) => host.call("overlays", { op: "move", id, anchor }),
  close: (id: string) => host.call("overlays", { op: "close", id }),
});

export type WebviewOverlaysClient = ReturnType<typeof createWebviewOverlaysClient>;

/** Track the rendered anchor only while its overlay is open, including CSS layout and animation. */
export const observeWebviewOverlayAnchor = (
  element: HTMLElement,
  onMove: (rect: WebviewOverlayRect) => void,
  onClose: () => void,
) => {
  const window = element.ownerDocument.defaultView!;
  let frame = 0;
  let previous = "";
  let active = true;
  const update = () => {
    if (!active) return;
    const rect = element.getBoundingClientRect();
    if (!element.isConnected || !rect.width || !rect.height) return onClose();
    const anchor = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const key = JSON.stringify(anchor);
    if (key !== previous) {
      previous = key;
      onMove(anchor);
    }
    if (active) frame = window.requestAnimationFrame(update);
  };
  update();
  return () => {
    active = false;
    window.cancelAnimationFrame(frame);
  };
};
