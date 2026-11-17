// This module must evaluate before any React renderer. The import installs only the early hook.
import { scan, setOptions } from "react-scan";
import { init } from "react-scan/install-hook";
import { createReactRenderOverlay } from "./modules/performance/react-render-overlay";

let observer: MutationObserver | undefined;
let visible = false;
const updateVisibility = () => {
  // Even showToolbar:false installs detail collectors in 0.5.3. Remove those before any interaction.
  // Deferred scanner setup repeats this work; the observer runs cleanup before the next event.
  const scanWindow = window as Window & { reactScanCleanupListeners?: () => void };
  scanWindow.reactScanCleanupListeners?.();
  scanWindow.reactScanCleanupListeners = undefined;
  for (const host of document.querySelectorAll<HTMLElement>("[data-react-scan], #react-scan-root")) {
    host.hidden = !visible;
  }
};

export const reactRenderOverlay =
  typeof window === "undefined"
    ? undefined
    : createReactRenderOverlay({
        scanner: {
          scan,
          setOptions,
          // 0.5.3's production detector returns null for a development renderer too.
          isSupported: () => init().renderers.size > 0,
        },
        storage: {
          removeItem: (key) => window.localStorage.removeItem(key),
        },
        setVisible(next, active) {
          visible = next;
          // React Scan creates its canvas on a later frame. A pause can precede that frame.
          if (active && !observer) {
            observer = new MutationObserver(updateVisibility);
            observer.observe(document.documentElement, { childList: true });
          }
          updateVisibility();
        },
      });

if (typeof window !== "undefined")
  window.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      reactRenderOverlay?.setEnabled(false);
      observer?.disconnect();
    },
    { once: true },
  );
