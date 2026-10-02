import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type PropsStore, type ResourceRef } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "../commands";
import { RadarContext } from "./client";

export const createView = (Component: ComponentType) =>
  defineExtensionView<{ resource?: ResourceRef }>({
    render({ mount, host, propsStore }) {
      const queryClient = new QueryClient();
      const client = createWebviewClient<typeof commands>(host);
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <QueryClientProvider client={queryClient}>
            <RadarContext.Provider
              value={{ host, client, propsStore: propsStore as PropsStore<{ resource?: ResourceRef }> }}
            >
              <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
                <Component />
              </Box>
            </RadarContext.Provider>
          </QueryClientProvider>
        </ChakraProvider>,
      );
      return () => {
        root.unmount();
        queryClient.clear();
      };
    },
  });
