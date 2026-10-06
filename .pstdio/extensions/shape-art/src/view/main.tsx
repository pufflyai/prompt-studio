import "@pstdio/ui/style.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, installPrismGlobal, psTheme } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

export default defineExtensionView({
  async render({ mount, host }) {
    // The shared UI bundle expects a Prism global before its components load.
    await installPrismGlobal();
    const { Studio } = await import("./studio");
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <Studio host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
