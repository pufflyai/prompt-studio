import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activity, type ComponentType, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { devCommands } from "../commands";
import { BenchmarksContext } from "./client";

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isVisible = () => !document.hidden;

export const createView = (Component: ComponentType) =>
  defineExtensionView({
    render({ mount, host }) {
      const queryClient = new QueryClient();
      const client = createWebviewClient<typeof devCommands>(host);
      const root = createRoot(mount);
      const Content = () => {
        const visible = useSyncExternalStore(subscribeVisibility, isVisible);
        return (
          <Activity mode={visible ? "visible" : "hidden"}>
            <Component />
          </Activity>
        );
      };
      root.render(
        <ChakraProvider value={psTheme}>
          <QueryClientProvider client={queryClient}>
            <BenchmarksContext.Provider value={{ host, client }}>
              <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
                <Content />
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
