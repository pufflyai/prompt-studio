import { Box, Button } from "@chakra-ui/react";
import { type CanvasBuildManifest, frameProtocol } from "@pstdio/canvas";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Component, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { type CanvasDefinition, toCanvas } from "../src/canvas-model";
import { createCanvasRuntime } from "../src/controller/runtime";
import { createFrameAssetLoader } from "../src/frames/asset-loader";
import { FrameLoaderContext } from "../src/frames/frame-loader";
import { readLayout } from "../src/layout";
import { documentationFixture, interactionFixture, populatedFixture } from "../src/view/canvas-fixtures";
import { CanvasStage } from "../src/view/canvas-stage";
import { CanvasThemeContext, CanvasThemeProvider } from "../src/view/canvas-theme";
import "@pstdio/ui/style.css";

// Renders UI Canvas outside the dashboard for browser checks. The server reads a build that
// `pstdio-canvas build` wrote, exactly as the extension does.
const load = createFrameAssetLoader(async (request) => {
  const response = await fetch(new URL("/preview-assets", location.href), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
});

declare global {
  interface Window {
    __CANVAS_VERIFICATION__: { saves: number; longTasks: number[] };
  }
}
window.__CANVAS_VERIFICATION__ = { saves: 0, longTasks: [] };
let maximumStarting = 0;
const starting = new Set<MessageEventSource>();
// Import handshakes finish before React commits its loading display.
window.addEventListener("message", (event) => {
  if (!event.source || event.data?.protocol !== frameProtocol) return;
  if (event.data.type === "bootstrap") starting.add(event.source);
  if (["imports-ready", "loaded", "error"].includes(event.data.type)) starting.delete(event.source);
  maximumStarting = Math.max(maximumStarting, starting.size);
  document.documentElement.dataset.canvasStartupMaximum = String(maximumStarting);
});
const longTasks = new PerformanceObserver((list) => {
  window.__CANVAS_VERIFICATION__.longTasks.push(...list.getEntries().map((entry) => entry.duration));
});
longTasks.observe({ type: "longtask", buffered: true });
class Boundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <p role="alert" data-ui-canvas-error>
          {this.state.error}
        </p>
      );
    return this.props.children;
  }
}

const query = new URLSearchParams(location.search);
const fixtures = [interactionFixture, documentationFixture, populatedFixture];
const missing: CanvasDefinition = {
  id: "failure",
  name: "Failure",
  group: "",
  items: [
    {
      id: "missing",
      name: "Missing preview",
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      preview: { source: "missing.canvas.tsx", exportName: "Missing", viewportHeight: 300, revision: "" },
    },
  ],
};

// `?frame=<canvas file>#<export>` shows one frame at a fixed viewport; `?canvas=<id>` a whole canvas.
const resolveCanvas = async (): Promise<CanvasDefinition | undefined> => {
  if (query.has("failure")) return missing;
  const fixture = fixtures.find((canvas) => canvas.id === query.get("canvas"));
  if (fixture) return fixture;
  const manifest = (await (await fetch("/manifest.json")).json()) as CanvasBuildManifest;
  const [source, exportName] = (query.get("frame") ?? "").split("#");
  const entry = manifest.canvases.find((canvas) => canvas.id === (query.get("canvas") ?? source));
  if (!entry) return undefined;
  const canvas = toCanvas(manifest, entry);
  if (!exportName) return canvas;
  const item = canvas.items.find((frame) => frame.id === exportName);
  if (!item) return undefined;
  const width = Number(query.get("viewport-width") ?? "1198");
  const height = Number(query.get("viewport-height") ?? "960");
  return {
    ...canvas,
    items: [
      {
        ...item,
        id: query.get("frame")!,
        width: width + 2,
        height,
        preview: { ...item.preview, viewportHeight: height },
      },
    ],
  };
};

const canvas = await resolveCanvas();
if (!canvas) throw new Error(`Unknown canvas ${query.get("canvas") ?? query.get("frame")}`);
const runtime = createCanvasRuntime(canvas, readLayout(null, canvas.items), () => {
  window.__CANVAS_VERIFICATION__.saves += 1;
});
const Harness = () => {
  const [dark, setDark] = useState(false);
  return (
    <ChakraProvider value={psTheme}>
      <CanvasThemeContext value={{ id: dark ? "pstdio-dark" : "pstdio-light", mode: dark ? "dark" : "light" }}>
        <CanvasThemeProvider>
          <FrameLoaderContext value={load}>
            <Box w="full" h="100vh" display="flex" flexDirection="column">
              <Button size="xs" onClick={() => setDark(!dark)}>
                Switch verification theme
              </Button>
              <Box flex="1" minH="0">
                <Boundary>
                  <CanvasStage canvas={canvas} runtime={runtime} />
                </Boundary>
              </Box>
            </Box>
          </FrameLoaderContext>
        </CanvasThemeProvider>
      </CanvasThemeContext>
    </ChakraProvider>
  );
};
createRoot(document.getElementById("root")!).render(<Harness />);
