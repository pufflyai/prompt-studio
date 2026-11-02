import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import type { commands } from "../commands";
import { createFrameAssetLoader } from "../frames/asset-loader";
import { FrameLoaderContext } from "../frames/frame-loader";
import type { CanvasProps } from "./root";
export default defineExtensionView<CanvasProps>({
  async render({ mount, host, propsStore }) {
    const client = createWebviewClient<typeof commands>(host);
    const load = createFrameAssetLoader((request) => client.commands["preview.assets"](request));
    const { CanvasRoot } = await import("./root");
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <FrameLoaderContext value={load}>
          <CanvasRoot host={host} propsStore={propsStore} />
        </FrameLoaderContext>
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
