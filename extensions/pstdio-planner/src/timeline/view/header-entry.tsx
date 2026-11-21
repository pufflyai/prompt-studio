import "@pstdio/ui/style.css";
import { Flex } from "@chakra-ui/react";
import { createWebviewQueryClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { ComponentProps } from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { autoBuildPageRef } from "../contracts";
import { AutoBuildControl } from "./auto-build-control";
import { createPlanClient } from "./use-plan";

function TimelineActions(props: Pick<ComponentProps<typeof AutoBuildControl>, "host" | "t">) {
  const [client] = useState(() => createPlanClient(props.host));
  return (
    <ChakraProvider value={psTheme}>
      <Flex h="100dvh" minW="0" align="center" justify="end">
        <AutoBuildControl
          {...props}
          client={client}
          onOpen={() =>
            void client.navigation.open({
              kind: "dialog",
              page: autoBuildPageRef,
            })
          }
        />
      </Flex>
    </ChakraProvider>
  );
}
export default defineExtensionView({
  render({ mount, host, t }) {
    const root = createRoot(mount);
    root.render(<TimelineActions host={host} t={t} />);
    return () => {
      root.unmount();
      createWebviewQueryClient(host).dispose();
    };
  },
});
