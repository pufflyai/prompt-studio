import type { WebviewOverlayRect, WebviewOverlayRequest } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./define-extension-view";

export const createWebviewOverlaysClient = (host: GuestHost) => ({
  /** Resolves when an action is selected or the overlay closes. */
  show: (request: WebviewOverlayRequest) => host.call("overlays", { op: "show", ...request }),
  move: (id: string, anchor: WebviewOverlayRect) => host.call("overlays", { op: "move", id, anchor }),
  close: (id: string) => host.call("overlays", { op: "close", id }),
});

export type WebviewOverlaysClient = ReturnType<typeof createWebviewOverlaysClient>;

/** Keep guest viewport coordinates current without polling or sharing guest DOM with the host. */
export const observeWebviewOverlayAnchor = (
  element: HTMLElement,
  onMove: (rect: WebviewOverlayRect) => void,
  onClose: () => void,
) => {
  const document = element.ownerDocument;
  const window = document.defaultView!;
  const update = () => {
    const rect = element.getBoundingClientRect();
    if (!element.isConnected || !rect.width || !rect.height) return onClose();
    onMove({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  };
  const resize = new window.ResizeObserver(update);
  resize.observe(element);
  document.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  const removal = new window.MutationObserver(update);
  removal.observe(document, { childList: true, characterData: true, subtree: true });
  update();
  return () => {
    resize.disconnect();
    removal.disconnect();
    document.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
  };
};
