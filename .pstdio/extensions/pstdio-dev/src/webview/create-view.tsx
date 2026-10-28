import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { benchmarkCommands } from "../benchmarks/commands";
import { BenchmarksContext } from "./client";

export const createView = (Component: ComponentType) =>
  defineExtensionView({
    render({ mount, host }) {
      const queryClient = new QueryClient();
      const client = createWebviewClient<typeof benchmarkCommands>(host);
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <QueryClientProvider client={queryClient}>
            <BenchmarksContext.Provider value={{ host, client }}>
              <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
                <Component />
              </Box>
            </BenchmarksContext.Provider>
          </QueryClientProvider>
        </ChakraProvider>,
      );
      return () => {
        root.unmount();
        queryClient.clear();
      };
    },
  });
