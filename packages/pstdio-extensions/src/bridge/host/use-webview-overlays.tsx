import type { WebviewOverlayRequest } from "pstdio-api-contracts/extension-kernel";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import {
  createWebviewOverlayController,
  type WebviewOverlayPresentation,
  webviewOverlayAnchor,
} from "./webview-overlays";

export const useWebviewOverlays = (
  frame: RefObject<HTMLIFrameElement | null>,
  contextKey: string,
  render?: (presentation: WebviewOverlayPresentation) => ReactNode,
) => {
  const [request, setRequest] = useState<WebviewOverlayRequest>();
  const [controller] = useState(() => createWebviewOverlayController(setRequest));
  const [bounds, setBounds] = useState<DOMRect>();
  // A retained view can move with panel layout without resizing its own iframe.
  useEffect(() => {
    if (!request) return;
    let task = 0;
    let previous = "";
    const measure = () => {
      const source = frame.current;
      const sourceBounds = source?.getBoundingClientRect();
      if (!source?.isConnected || !sourceBounds?.width || !sourceBounds.height) {
        controller.close();
        return;
      }
      const anchor = request.anchor;
      if (
        anchor.x + anchor.width <= 0 ||
        anchor.y + anchor.height <= 0 ||
        anchor.x >= source.clientWidth ||
        anchor.y >= source.clientHeight
      ) {
        controller.close();
        return;
      }
      const rect = webviewOverlayAnchor(
        { bounds: sourceBounds, width: source.clientWidth, height: source.clientHeight },
        request.anchor,
      );
      const key = JSON.stringify(rect);
      if (key !== previous) {
        previous = key;
        setBounds(new DOMRect(rect.x, rect.y, rect.width, rect.height));
      }
      task = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(task);
  }, [request, frame, controller]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: replacing the browsing context releases its outstanding overlay reply.
  useEffect(() => () => controller.dispose(), [controller, contextKey]);
  return {
    capabilities: render ? { overlays: controller.call } : {},
    content:
      request &&
      bounds &&
      render?.({
        request,
        getAnchorRect: () => bounds,
        close: (actionId, restoreFocus = true) => {
          controller.close(actionId);
          if (restoreFocus) frame.current?.focus({ preventScroll: true });
        },
      }),
  };
};
