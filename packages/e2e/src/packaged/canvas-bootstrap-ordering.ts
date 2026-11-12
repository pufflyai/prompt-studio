import type { Page } from "@playwright/test";

// Let the real child document run before one parent passive-effect turn. This
// exercises the browser's permitted ordering without fabricating any handshake.
export const deferCanvasBootstrapEffect = (page: Page) =>
  page.addInitScript(() => {
    if (!location.pathname.endsWith("/pstdio.canvas.view.canvas/runtime")) return;
    const NativeChannel = window.MessageChannel;
    const nativeListener = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessage")?.set;
    if (!nativeListener) throw new Error("Canvas ordering regression requires native MessagePort dispatch");
    let deferred = false;
    window.MessageChannel = class extends NativeChannel {
      constructor() {
        super();
        const port = this.port1;
        let listener: ((this: MessagePort, event: MessageEvent) => unknown) | null = null;
        Object.defineProperty(port, "onmessage", {
          configurable: true,
          get: () => listener,
          set: (next: typeof listener) => {
            listener = next;
            nativeListener.call(
              port,
              next === null
                ? null
                : (event: MessageEvent) => {
                    if (
                      !deferred &&
                      event.data === null &&
                      next.toString().includes("unstable_now") &&
                      document.querySelector("iframe[data-ui-canvas-component]")
                    ) {
                      deferred = true;
                      document.documentElement.dataset.canvasBootstrapEffectDeferred = "true";
                      // Restore ordinary dispatch and preserve this callback/event exactly once.
                      nativeListener.call(port, next);
                      setTimeout(() => next.call(port, event), 50);
                    } else next.call(port, event);
                  },
            );
          },
        });
      }
    };
  });
