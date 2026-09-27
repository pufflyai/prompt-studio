import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import { type PreviewProps, PreviewRoot } from "./preview";

export default defineExtensionView<PreviewProps>({
  render({ mount, host, propsStore }) {
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
          <PreviewRoot host={host} propsStore={propsStore} />
        </Box>
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
