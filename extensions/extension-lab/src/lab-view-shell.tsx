import "@pstdio/ui/style.css";
import "./styles.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type LabHostProps, LabHostProvider } from "./host-context";

export const createLabView = (renderView: () => ReactNode) =>
  defineExtensionView<LabHostProps>({
    render({ mount, host, propsStore }) {
      const root = createRoot(mount);
      root.render(
        <StrictMode>
          <ChakraProvider value={psTheme}>
            <LabHostProvider host={host} propsStore={propsStore}>
              {renderView()}
            </LabHostProvider>
          </ChakraProvider>
        </StrictMode>,
      );

      return () => root.unmount();
    },
  });
