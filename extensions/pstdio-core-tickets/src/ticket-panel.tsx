import "@pstdio/ui/style.css";

import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionViewProps } from "./ticket-panel-types";
import { TicketPanelView } from "./ticket-panel-view";

export default defineExtensionView<ExtensionViewProps>({
  render({ mount, host, propsStore }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <TicketPanelView host={host} propsStore={propsStore} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
