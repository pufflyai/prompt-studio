import "@pstdio/ui/style.css";
import { Button, Heading, Stack, Text, Textarea } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { letterPage, letterResource } from "../renderers/panel-view-contracts";
import type { completeLetter, deleteLetter } from "../renderers/panel-views";

const LetterReader = (props: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const { context } = props;
  const { resource, projectId } = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const [client] = useState(() =>
    createWebviewClient<{ "complete-letter": typeof completeLetter; "delete-letter": typeof deleteLetter }>(
      context.host,
    ),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const run = (operation: () => Promise<unknown>) => void operation().catch((error) => setError(String(error)));
  return (
    <Stack p="md" gap="sm">
      <Heading size="sm">{resource?.label ?? "New letter"}</Heading>
      <Text>Viewing {resource?.id ?? "landing"}</Text>
      <Textarea aria-label="Letter draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      {(["A", "B"] as const).map((id) => (
        <Button
          key={id}
          size="sm"
          variant="outline"
          onClick={() =>
            run(() =>
              context.host.call("navigation.open", {
                target: {
                  kind: "viewer",
                  operation: "switch",
                  from: resource,
                  resource: letterResource(id, projectId),
                  ...(!resource ? { page: letterPage } : {}),
                },
              }),
            )
          }
        >
          Switch to {id}
        </Button>
      ))}
      <Button size="sm" onClick={() => run(() => client.commands["complete-letter"]({ delay: 0 }))}>
        Save letter
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => run(() => client.commands["complete-letter"]({ delay: 1500 }))}
      >
        Save letter slowly
      </Button>
      {resource && (
        <Button size="sm" variant="outline" onClick={() => run(() => client.commands["delete-letter"]())}>
          Delete letter
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
        <LetterReader context={context} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
