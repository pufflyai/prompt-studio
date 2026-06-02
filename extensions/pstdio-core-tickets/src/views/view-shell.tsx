import "@pstdio/ui/style.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type TicketHostProps, TicketHostProvider } from "./host-context";

export const createTicketView = (renderView: () => ReactNode) =>
  defineExtensionView<TicketHostProps>({
    render({ mount, host, propsStore }) {
      const root = createRoot(mount);
      root.render(
        <StrictMode>
          <ChakraProvider value={psTheme}>
            <TicketHostProvider host={host} propsStore={propsStore}>
              {renderView()}
            </TicketHostProvider>
          </ChakraProvider>
        </StrictMode>,
      );

      return () => root.unmount();
    },
  });
