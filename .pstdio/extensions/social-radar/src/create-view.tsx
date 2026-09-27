import "@pstdio/ui/style.css";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { HostContext } from "./host";
export const createView = (Component: ComponentType) =>
  defineExtensionView({
    render({ mount, host }) {
      const client = new QueryClient({ defaultOptions: { queries: { refetchInterval: 5000 } } });
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <QueryClientProvider client={client}>
            <HostContext.Provider value={host}>
              <Component />
            </HostContext.Provider>
          </QueryClientProvider>
        </ChakraProvider>,
      );
      return () => {
        root.unmount();
        client.clear();
      };
    },
  });
