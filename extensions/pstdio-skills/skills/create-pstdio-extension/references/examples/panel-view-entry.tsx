import "@pstdio/ui/style.css";
import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { createNote } from "./panel-view";

const NoteView = (props: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const { context } = props;
  const { resource } = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<{ "create-note": typeof createNote }>(context.host));
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const create = async () => {
    try {
      await client.commands["create-note"]({ title });
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <Stack p="md" gap="sm">
      <Heading size="sm">{resource?.label ?? "New note"}</Heading>
      {resource?.type !== "note" && (
        <>
          <Input aria-label="Note title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Button size="sm" onClick={() => void create()}>
            Save note
          </Button>
        </>
      )}
      {resource?.type === "note" && (
        <Button
          size="sm"
          onClick={() =>
            void context.host.call("navigation.open", {
              target: {
                kind: "page",
                page: { kind: "page", id: "note" },
                resource,
              },
            })
          }
        >
          Open note
        </Button>
      )}
      {error && <Text role="alert">{error}</Text>}
    </Stack>
  );
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <NoteView context={context} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
