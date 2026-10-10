// Mount the execution plan with the host's shared UI and dispose it when the view closes.
import "@pstdio/ui/style.css";
import { Box, Text } from "@chakra-ui/react";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, installPrismGlobal, psTheme } from "@pstdio/ui";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

// The shared Planner toolbar loads the editor bundle, which requires the UI's Prism bootstrap first.
const PlanRoot = lazy(async () => {
  await installPrismGlobal();
  const view = await import("./plan-root");
  return { default: view.PlanRoot };
});

export default defineExtensionView({
  render({ mount, host, t }) {
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
          <Suspense fallback={<Text p="md">Loading tickets…</Text>}>
            <PlanRoot host={host} t={t} />
          </Suspense>
        </Box>
      </ChakraProvider>,
    );

    return () => root.unmount();
  },
});
