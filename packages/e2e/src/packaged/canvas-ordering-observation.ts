import type { Page } from "@playwright/test";
import { observeCanvas } from "./packaged-canvas-observation";

// Counterfactual on unmodified main: permit the child document to run before one
// already-scheduled parent passive-effect turn. Never fabricate bootstrap messages.
export const observeCanvasOrdering = async (page: Page, began: number, root: string) => {
  const stop = await observeCanvas(page, began, root);
  try {
    await page.addInitScript(() => {
      const write = (value: unknown) => {
        try {
          console.log("canvas-ordering", JSON.stringify(value));
        } catch {
          /* Observation only. */
        }
      };
      let realm = "extension-runtime";
      if (window === window.top) realm = "dashboard";
      if (location.href === "about:srcdoc") realm = "preview";
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message?.protocol !== "pstdio.canvas.preview") return;
        write({
          phase: "message",
          path: location.pathname,
          realm,
          fromParent: event.source === window.parent,
          time: performance.now(),
          type: message.type,
          hasBootstrap: message.bootstrap !== undefined,
          error: message.message,
        });
      });
      if (!location.pathname.endsWith("/pstdio.canvas.view.canvas/runtime")) return;
      const NativeChannel = window.MessageChannel;
      const onmessage = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessage");
      if (!onmessage?.set) {
        write({ phase: "gate-unavailable" });
        return;
      }
      let used = false;
      const observer = new MutationObserver(() => {
        if (document.querySelector("iframe[data-ui-canvas-component]")) {
          write({ phase: "preview-inserted", time: performance.now() });
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      window.MessageChannel = class extends NativeChannel {
        constructor() {
          super();
          const channelStack = new Error().stack;
          const port = this.port1;
          let listener: ((this: MessagePort, event: MessageEvent) => unknown) | null = null;
          Object.defineProperty(port, "onmessage", {
            configurable: true,
            get: () => listener,
            set: (next: typeof listener) => {
              listener = next;
              onmessage.set!.call(
                port,
                next === null
                  ? null
                  : (event: MessageEvent) => {
                      const preview = document.querySelector<HTMLIFrameElement>("iframe[data-ui-canvas-component]");
                      if (!used && event.data === null && preview) {
                        used = true;
                        write({
                          phase: "scheduler-turn-deferred",
                          time: performance.now(),
                          delayMs: 50,
                          channelStack,
                          callback: next?.toString().slice(0, 4000),
                          modules: preview.dataset.frameModules,
                        });
                        // Preserve the original callback/event exactly once, then restore native dispatch.
                        onmessage.set!.call(port, next);
                        setTimeout(() => next?.call(port, event), 50);
                      } else next?.call(port, event);
                    },
              );
            },
          });
        }
      };
    });
  } catch (error) {
    console.warn("Canvas ordering observation unavailable", error);
  }
  return stop;
};
