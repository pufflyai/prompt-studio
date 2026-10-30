import "@pstdio/ui/style.css";
import { ChakraProvider, psTheme, type ThemePreferenceOption, ThemePreferenceProvider } from "@pstdio/ui";
import { Component, type ComponentType, type ReactNode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { CanvasItem } from "../src/canvases/definitions";
import { createFrameAssetBridge } from "../src/frames/asset-bridge";
import { installFrameAssetLoader } from "../src/frames/assets";
import { type FrameMessage, type FrameRequest, frameProtocol } from "../src/frames/protocol";
import { installFrameNavigation } from "./frame-navigation";
import { FrameStory, inspect, type LoadedStory } from "./frame-story";

const storage = { getItem: () => null, setItem: () => {} };
export const mountPreviewRuntime = (
  load: (input: import("../src/catalog/definitions").StoryPreview, imported: () => void) => Promise<LoadedStory>,
  loadNative: (component: string) => Promise<ComponentType<Record<string, unknown>>>,
) => {
  const booted = performance.now();
  let nonce = "";
  const send = (message: Omit<FrameMessage, "protocol" | "nonce">) =>
    window.parent.postMessage({ protocol: frameProtocol, nonce, ...message }, "*");
  const assets = createFrameAssetBridge(send);
  const cleanupAssets = installFrameAssetLoader(assets.load);
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
  const ReadyStory = (props: { loaded: LoadedStory; viewportHeight: number }) => {
    const { loaded, viewportHeight } = props;
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
        information: {
          args: inspect(loaded.args),
          description: loaded.description,
        },
      });
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() =>
          send({
            type: "painted",
            timings: { firstPaintMs: performance.now() },
          }),
        );
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }, [loaded]);
    return <FrameStory loaded={loaded} minimumHeight={loaded.fullscreen ? viewportHeight : 0} />;
  };
  const root = document.getElementById("root")!;
  const reactRoot = createRoot(root);
  let theme: ThemePreferenceOption = { id: "pstdio-light", mode: "light" };
  let loaded: LoadedStory | undefined;
  let item: CanvasItem | undefined;
  let active = true;
  const App = (props: { loaded: LoadedStory; item: CanvasItem; theme: ThemePreferenceOption }) => (
    <ChakraProvider value={psTheme}>
      <ThemePreferenceProvider initialPreference={props.theme.id} themePreferences={[props.theme]} storage={storage}>
        <Boundary>
          <ReadyStory
            loaded={props.loaded}
            viewportHeight={props.item.preview?.kind === "story" ? props.item.preview.viewportHeight : 960}
          />
        </Boundary>
      </ThemePreferenceProvider>
    </ChakraProvider>
  );
  const render = () => {
    if (active && loaded && item) reactRoot.render(<App loaded={loaded} item={item} theme={theme} />);
  };
  const loadContent = async (next: CanvasItem) => {
    item = next;
    const started = performance.now();
    const result: LoadedStory = next.preview
      ? await load(next.preview, () => send({ type: "imports-ready" }))
      : {
          Component: await loadNative(next.component!),
          timings: { importMs: performance.now() - started, setupMs: 0 },
        };
    if (!next.preview) send({ type: "imports-ready" });
    if (!active) return result.dispose?.();
    loaded = result;
    // Mount providers once, with the requested theme and content already available.
    render();
  };
  const receive = (event: MessageEvent<FrameRequest>) => {
    const message = event.data;
    if (event.source !== window.parent || message?.protocol !== frameProtocol) return;
    if (nonce && message.nonce !== nonce) return;
    nonce = message.nonce;
    if (message.theme) theme = message.theme;
    switch (message.type) {
      case "assets":
        assets.receive(message);
        break;
      case "theme":
        render();
        break;
      case "render":
        if (!message.item || item) return;
        void loadContent(message.item).catch((error) => {
          if (!active) return;
          reactRoot.render(
            <div role="alert" data-ui-canvas-error>
              {String(error)}
            </div>,
          );
          send({ type: "error", message: String(error) });
        });
        break;
    }
  };
  window.addEventListener("message", receive);
  send({ type: "boot" });
  let scheduled = 0;
  let previous = 0;
  const measure = () => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      const modal = document.querySelector(
        '[data-scope="dialog"][data-state="open"], [data-scope="popover"][data-state="open"], [data-scope="menu"][data-state="open"]',
      );
      const height = Math.ceil(Math.max(root.offsetHeight, root.scrollHeight, modal ? 960 : 1));
      if (height !== previous) {
        previous = height;
        send({ type: "height", height });
      }
    });
  };
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  const mutationObserver = new MutationObserver(measure);
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });
  document.fonts.addEventListener("loadingdone", measure);
  void document.fonts.ready.then(measure);
  installFrameNavigation(send);
  window.addEventListener(
    "pagehide",
    () => {
      active = false;
      window.removeEventListener("message", receive);
      loaded?.dispose?.();
      cancelAnimationFrame(scheduled);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      reactRoot.unmount();
      assets.dispose();
      cleanupAssets();
    },
    { once: true },
  );
};
