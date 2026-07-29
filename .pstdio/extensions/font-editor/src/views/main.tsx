import "@pstdio/ui/style.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FontEditorPage } from "./font-editor-page";

export default defineExtensionView({
  render({ mount, host, files }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <FontEditorPage host={host} files={files} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
