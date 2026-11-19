// Install the renderer hook before React DOM. Load the outline painter only on a local request.
import { init } from "react-scan/install-hook";
import { createReactRenderOverlay } from "./modules/performance/react-render-overlay";

export const reactRenderOverlay =
  typeof window === "undefined"
    ? undefined
    : createReactRenderOverlay({
        isSupported: () => init().renderers.size > 0,
        load: async () => (await import("./modules/performance/react-render-highlights")).startRenderHighlights,
      });

if (reactRenderOverlay) {
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) void reactRenderOverlay.setEnabled(false);
  });
}
