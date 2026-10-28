import "@pstdio/ui/style.css";
import {
  ChakraProvider,
  installPrismGlobal,
  psTheme,
  type ThemePreferenceOption,
  ThemePreferenceProvider,
} from "@pstdio/ui";
import { Component, type ComponentType, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CanvasItem } from "../src/canvases/definitions";
import { installFrameBootstrap } from "../src/frames/assets";
import { type FrameMessage, type FrameRequest, frameProtocol } from "../src/frames/protocol";
import { installFrameNavigation } from "./frame-navigation";
import { FrameStory, inspect, type LoadedStory } from "./frame-story";

const installBootstrap = (message: FrameRequest) => {
  if (message.bootstrap) installFrameBootstrap(message.bootstrap);
};
const storage = { getItem: () => null, setItem: () => {} };
export const mountPreviewRuntime = (
  load: (
    input: import("../src/catalog/definitions").StoryPreview | import("../src/catalog/definitions").DocumentPreview,
  ) => Promise<LoadedStory>,
) => {
  let nonce = "";
  const send = (message: Omit<FrameMessage, "protocol" | "nonce">) =>
    window.parent.postMessage({ protocol: frameProtocol, nonce, ...message }, "*");
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
  const ReadyStory = (props: { loaded: LoadedStory }) => {
    const { loaded } = props;
    useEffect(() => {
      const docs = loaded.parameters?.docs as { description?: { story?: string } } | undefined;
      send({
        type: "loaded",
        information: {
          args: inspect(loaded.args),
          argTypes: inspect(loaded.argTypes),
          description: docs?.description?.story,
          hasPlay: loaded.hasPlay,
        },
      });
    }, [loaded]);
    return <FrameStory loaded={loaded} minimumHeight={loaded.parameters?.layout === "fullscreen" ? 960 : 0} />;
  };
  const Content = (props: { item: CanvasItem }) => {
    const { item } = props;
    const [loaded, setLoaded] = useState<LoadedStory>();
    useEffect(() => {
      let active = true;
      const loadContent = async () => {
        await installPrismGlobal();
        if (item.preview) return load(item.preview);
        const { previews } = await import("../src/canvases/previews");
        return { Component: previews[item.component!] as ComponentType<Record<string, unknown>> };
      };
      void loadContent()
        .then((value) => {
          const result: LoadedStory = value;
          if (!active) return;
          setLoaded(result);
        })
        .catch((error) => send({ type: "error", message: String(error) }));
      return () => {
        active = false;
      };
    }, [item]);
    if (!loaded) return <div data-ui-canvas-loading>Loading preview…</div>;
    return <ReadyStory loaded={loaded} />;
  };
  const App = () => {
    const [request, setRequest] = useState<FrameRequest>();
    const [theme, setTheme] = useState<ThemePreferenceOption>({ id: "pstdio-light", mode: "light" });
    useEffect(() => {
      const receive = (event: MessageEvent<FrameRequest>) => {
        const message = event.data;
        if (event.source !== window.parent || message?.protocol !== frameProtocol) return;
        if (nonce && message.nonce !== nonce) return;
        nonce = message.nonce;
        if (message.theme) setTheme(message.theme);
        installBootstrap(message);
        switch (message.type) {
          case "render":
            setRequest(message);
            break;
        }
      };
      window.addEventListener("message", receive);
      send({ type: "boot" });
      return () => window.removeEventListener("message", receive);
    }, []);
    return (
      <ChakraProvider value={psTheme}>
        <ThemePreferenceProvider initialPreference={theme.id} themePreferences={[theme]} storage={storage}>
          {request?.item && (
            <Boundary>
              <Content item={request.item} />
            </Boundary>
          )}
        </ThemePreferenceProvider>
      </ChakraProvider>
    );
  };
  const root = document.getElementById("root")!;
  createRoot(root).render(<App />);
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
  new ResizeObserver(measure).observe(root);
  new MutationObserver(measure).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });
  document.fonts.addEventListener("loadingdone", measure);
  void document.fonts.ready.then(measure);
  installFrameNavigation(send);
};
