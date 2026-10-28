import "@pstdio/ui/style.css";
import { Button, Heading, Stack } from "@chakra-ui/react";
import { defineExtensionView, type WebviewHostProps } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import { letterPage, letterResource } from "../renderers/panel-view-contracts";

export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Stack p="md" gap="sm">
          <Heading size="sm">Letter browser</Heading>
          {(["A", "B"] as const).map((id) => (
            <Button
              key={id}
              size="sm"
              onClick={() =>
                void context.host.call("navigation.open", {
                  target: {
                    kind: "page",
                    page: letterPage,
                    resource: letterResource(id, context.propsStore.get().projectId),
                    open: "pin",
                  },
                })
              }
            >
              Open {id} in Main
            </Button>
          ))}
        </Stack>
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
