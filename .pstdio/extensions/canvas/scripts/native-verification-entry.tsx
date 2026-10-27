import { Box, Button } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Component, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
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
const canvas = verificationCanvases.find((canvas) => canvas.id === id);
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
          <Box h="100vh" display="flex" flexDirection="column">
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
