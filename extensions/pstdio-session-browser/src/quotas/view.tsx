import "@pstdio/ui/style.css";
import { Stack } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { quotas } from "./commands";
import { SessionQuotas } from "./components/session-quotas";

const QuotasPage = ({ host }: { host: Parameters<typeof createWebviewClient>[0] }) => {
  const [client] = useState(() => createWebviewClient<{ quotas: typeof quotas }>(host));
  return (
    <ChakraProvider value={psTheme}>
      <ScrollArea height="100dvh" width="full">
        <Stack p="lg" width="full" maxW="52rem" mx="auto">
          <SessionQuotas client={client} visible={useWebviewVisibility()} />
        </Stack>
      </ScrollArea>
    </ChakraProvider>
  );
};

export default defineExtensionView({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<QuotasPage host={context.host} />);
    return () => root.unmount();
  },
});
