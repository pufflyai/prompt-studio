import { Box, Button } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Component, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CanvasDefinition } from "../src/canvases/definitions";
import catalog from "../src/catalog/generated/stories.json";
import { CanvasThemeContext, CanvasThemeProvider } from "../src/catalog/theme";
import { createCanvasRuntime } from "../src/controller/runtime";
import { readLayout } from "../src/layout";
import { CanvasStage } from "../src/view/canvas-stage";
import { verificationCanvases } from "./native-verification-fixtures";
import "@pstdio/ui/style.css";

declare global {
  interface Window {
    __CANVAS_VERIFICATION__: { saves: number; longTasks: number[] };
  }
}
window.__CANVAS_VERIFICATION__ = { saves: 0, longTasks: [] };
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
const id = new URLSearchParams(location.search).get("canvas");
const variantId = new URLSearchParams(location.search).get("preview");
const documentEntry = catalog.documents.find((entry) => entry.id === variantId);
const variant = catalog.stories.find((entry) => entry.id === variantId);
const resolveCanvas = (): CanvasDefinition | undefined => {
  if (new URLSearchParams(location.search).has("failure"))
    return {
      id: "failure",
      name: "Failure",
      items: [
        {
          id: "missing",
          name: "Missing preview",
          position: { x: 0, y: 0 },
          width: 400,
          height: 300,
          preview: {
            kind: "story",
            id: "missing",
            source: "missing.canvas.tsx",
            suite: "ui",
            exportName: "Missing",
            viewportHeight: 300,
          },
        },
      ],
    };
  if (variant)
    return {
      id: "single-preview",
      name: "Test preview",
      items: [
        {
          id: variant.id,
          name: variant.name,
          position: { x: 0, y: 0 },
          width: 1200,
          height: 960,
          preview: { kind: "story", ...variant, viewportHeight: 960 },
        },
      ],
    };
  if (documentEntry)
    return {
      id: "document-preview",
      name: "Document preview",
      items: [
        {
          id: documentEntry.id,
          name: documentEntry.name,
          position: { x: 0, y: 0 },
          width: 1200,
          height: 240,
          preview: { kind: "document", ...documentEntry },
        },
      ],
    };
  return verificationCanvases.find((canvas) => canvas.id === id);
};
const canvas = resolveCanvas();
if (!canvas) throw new Error(`Unknown canvas ${id}`);
const runtime = createCanvasRuntime(canvas, readLayout(null, canvas.items), () => {
  window.__CANVAS_VERIFICATION__.saves += 1;
});
const Harness = () => {
  const [dark, setDark] = useState(false);
  return (
    <ChakraProvider value={psTheme}>
      <CanvasThemeContext value={{ id: dark ? "pstdio-dark" : "pstdio-light", mode: dark ? "dark" : "light" }}>
        <CanvasThemeProvider>
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
        </CanvasThemeProvider>
      </CanvasThemeContext>
    </ChakraProvider>
  );
};
createRoot(document.getElementById("root")!).render(<Harness />);
