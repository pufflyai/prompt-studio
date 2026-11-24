import "@pstdio/ui/style.css";
import { Button, Heading, Input, Stack } from "@chakra-ui/react";
import { defineExtensionView, type WebviewHostProps } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { letterPage, letterResource } from "./panel-view-contracts";

const MenuDraft = () => {
  const [value, setValue] = useState("");
  return <Input aria-label="Letter menu draft" value={value} onChange={(event) => setValue(event.target.value)} />;
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Stack p="md" gap="sm">
          <Heading size="sm">Letter browser</Heading>
          <MenuDraft />
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
