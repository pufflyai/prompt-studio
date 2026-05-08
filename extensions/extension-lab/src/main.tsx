import "@pstdio/ui/style.css";
import "./styles.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type LabHostProps, LabHostProvider } from "./host-context";
import { LabPage } from "./views/lab-page";

export default defineExtensionView<LabHostProps>({
  render({ mount, host, propsStore }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <LabHostProvider host={host} propsStore={propsStore}>
            <LabPage />
          </LabHostProvider>
        </ChakraProvider>
      </StrictMode>,
    );

    return () => root.unmount();
  },
});
