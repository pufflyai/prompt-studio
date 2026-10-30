import "@pstdio/ui/style.css";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import type { CanvasProps } from "./root";
export default defineExtensionView<CanvasProps>({
  async render({ mount, host, propsStore }) {
    const { CanvasRoot } = await import("./root");
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <CanvasRoot host={host} propsStore={propsStore} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
