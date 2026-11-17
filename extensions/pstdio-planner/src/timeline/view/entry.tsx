// Mount the execution plan with the host's shared UI and dispose it when the view closes.
import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { createWebviewQueryClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Activity, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { PlanRoot } from "./plan-root";

function Timeline(props: ComponentProps<typeof PlanRoot>) {
  const { host, t } = props;
  const visible = useWebviewVisibility();
  return (
    <ChakraProvider value={psTheme}>
      <Box h="100dvh" w="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
        <Activity mode={visible ? "visible" : "hidden"}>
          <PlanRoot host={host} t={t} />
        </Activity>
      </Box>
    </ChakraProvider>
  );
}

export default defineExtensionView({
  render({ mount, host, t }) {
    const root = createRoot(mount);
    root.render(<Timeline host={host} t={t} />);

    return () => {
      root.unmount();
      createWebviewQueryClient(host).dispose();
    };
  },
});
