import { Component, type ReactNode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { type CanvasFrame, type CanvasMeta, type CanvasPreview, CanvasThemeContext, composePreview } from "../compose";
import { createFrameAssetBridge } from "./assets";
import { LiveFrame } from "./live-frame";
import { installFrameNavigation } from "./navigation";
import { type FrameItem, type FrameMessage, type FrameRequest, type FrameTheme, frameProtocol } from "./protocol";

/** How the generated frame entry loads one canvas file and its nearest `.canvas/preview.tsx`. */
export interface FrameSource {
  load: () => Promise<Record<string, unknown>>;
  preview?: () => Promise<{ default?: unknown }>;
}

// Zag and Ark components mark open overlays with `data-state`; plain ARIA dialogs mark themselves modal.
const MODAL_SELECTOR = [
  ...["dialog", "popover", "menu"].map((scope) => `[data-scope="${scope}"][data-state="open"]`),
  '[role="dialog"][aria-modal="true"]',
  '[role="alertdialog"]',
].join(", ");

type LoadedFrame = Awaited<ReturnType<typeof composePreview>> & { timings: Record<string, number> };

const inspect = (value: unknown) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "function") return `[callback ${item.name || "local"}]`;
      if (typeof item === "bigint" || typeof item === "symbol") return String(item);
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[shared reference]";
        seen.add(item);
      }
      return item;
    },
    2,
  );
};

/** Renders one canvas frame inside a UI Canvas iframe. The generated build entry calls this. */
export const mountFrameRuntime = (sources: Record<string, FrameSource>) => {
  const booted = performance.now();
  let nonce = "";
  const send = (message: Omit<FrameMessage, "protocol" | "nonce">) =>
    window.parent.postMessage({ protocol: frameProtocol, nonce, ...message }, "*");
  const assets = createFrameAssetBridge(send);

  class Boundary extends Component<{ children: ReactNode }, { error?: string }> {
    state: { error?: string } = {};
    static getDerivedStateFromError(error: Error) {
      return { error: error.message };
    }
    componentDidCatch(error: Error) {
      send({ type: "error", message: error.message });
    }
    render() {
      return this.state.error ? <div role="alert">{this.state.error}</div> : this.props.children;
    }
  }

  const Ready = (props: { loaded: LoadedFrame; minimumHeight: number }) => {
    const { loaded, minimumHeight } = props;
    useLayoutEffect(() => {
      let second = 0;
      // Offscreen iframe animation frames can be suspended; readiness must not wait for paint.
      send({
        type: "loaded",
        timings: {
          ...loaded.timings,
          bootstrapMs: booted - (performance.getEntriesByName("canvas:bootstrap-received")[0]?.startTime ?? 0),
          committedMs: performance.now(),
        },
        information: { args: inspect(loaded.args), description: loaded.description },
      });
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => send({ type: "painted", timings: { firstPaintMs: performance.now() } }));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }, [loaded]);
    return (
      <div
        data-preview-content
        style={{ display: "grid", minHeight: minimumHeight ? `${minimumHeight}px` : undefined }}
      >
        <LiveFrame Frame={loaded.Component} args={loaded.args} />
      </div>
    );
  };

  const load = async (item: FrameItem): Promise<LoadedFrame> => {
    const preview = item.preview;
    if (!preview) throw new Error("This frame has no preview");
    const source = sources[preview.source];
    if (!source) throw new Error(`Missing preview source: ${preview.source}`);
    const started = performance.now();
    const [module, project] = await Promise.all([source.load(), source.preview?.()]);
    const frame = module[preview.exportName];
    if (frame === undefined) throw new Error(`Missing preview: ${preview.source}#${preview.exportName}`);
    send({ type: "imports-ready" });
    const importedAt = performance.now();
    const composed = composePreview(
      frame as CanvasFrame,
      (module.default ?? {}) as CanvasMeta,
      (project?.default ?? {}) as CanvasPreview,
    );
    return { ...composed, timings: { importMs: importedAt - started, setupMs: performance.now() - importedAt } };
  };

  const root = document.getElementById("root")!;
  const reactRoot = createRoot(root);
  let theme: FrameTheme = { id: "light", mode: "light" };
  let item: FrameItem | undefined;
  let loaded: LoadedFrame | undefined;
  let active = true;
  const render = () => {
    if (!active || !loaded || !item) return;
    const minimumHeight = loaded.fullscreen ? (item.preview?.viewportHeight ?? 960) : 0;
    reactRoot.render(
      <CanvasThemeContext.Provider value={theme}>
        <Boundary>
          <Ready loaded={loaded} minimumHeight={minimumHeight} />
        </Boundary>
      </CanvasThemeContext.Provider>,
    );
  };
  const receive = (event: MessageEvent<FrameRequest>) => {
    const message = event.data;
    if (event.source !== window.parent || message?.protocol !== frameProtocol) return;
    if (nonce && message.nonce !== nonce) return;
    nonce = message.nonce;
    if (message.theme) theme = message.theme;
    if (message.type === "assets") assets.receive(message);
    if (message.type === "theme") render();
    if (message.type !== "render" || !message.item || item) return;
    item = message.item;
    void load(message.item)
      .then((result) => {
        if (!active) return;
        loaded = result;
        render();
      })
      .catch((error) => {
        if (!active) return;
        reactRoot.render(<div role="alert">{String(error)}</div>);
        send({ type: "error", message: String(error) });
      });
  };
  window.addEventListener("message", receive);
  send({ type: "boot" });

  let scheduled = 0;
  let previous = 0;
  const measure = () => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      // An open dialog, popover or menu is positioned outside the content's height, so the frame
      // grows to the viewport while one is open.
      const modal = document.querySelector(MODAL_SELECTOR) ? (item?.preview?.viewportHeight ?? 960) : 1;
      const height = Math.ceil(Math.max(root.offsetHeight, root.scrollHeight, modal));
      if (height === previous) return;
      previous = height;
      send({ type: "height", height });
    });
  };
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  const mutationObserver = new MutationObserver(measure);
  mutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true });
  document.fonts.addEventListener("loadingdone", measure);
  void document.fonts.ready.then(measure);
  installFrameNavigation(send);
  window.addEventListener(
    "pagehide",
    () => {
      active = false;
      window.removeEventListener("message", receive);
      cancelAnimationFrame(scheduled);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      reactRoot.unmount();
      assets.dispose();
    },
    { once: true },
  );
};
