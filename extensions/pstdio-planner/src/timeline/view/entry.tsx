// Mount the execution plan with the host's shared UI and dispose it when the view closes.
import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import { PlanRoot } from "./plan-root";

export default defineExtensionView({
  render({ mount, host, t }) {
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
          <PlanRoot host={host} t={t} />
        </Box>
      </ChakraProvider>,
    );

    return () => root.unmount();
  },
});
