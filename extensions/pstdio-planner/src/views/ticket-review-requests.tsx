import "@pstdio/ui/style.css";
import { Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  createWebviewQueryClient,
  defineExtensionView,
  type GuestHost,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { useWebviewScope } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { RequestsPanel } from "../timeline/view/requests-panel";
import { PlannerReadError } from "./planner-read-error";
import {
  type TicketRequestsClient,
  type TicketRequestsCommands,
  useTicketRequests,
} from "./use-ticket-review-requests";

interface HostProps {
  resource?: ResourceRef;
}

function TicketRequests(props: { client: TicketRequestsClient; resource: ResourceRef }) {
  const { client, resource } = props;
  const { value, error, retry, answer, openChat } = useTicketRequests(client, resource);
  return (
    <ScrollArea h="full">
      <Stack p="md" gap="md" w="full" maxW="2xl" mx="auto">
        <PlannerReadError error={error} retry={retry} />
        <Text textStyle="label/L/medium">{resource.label ?? resource.shorthand}</Text>
        {value ? (
          <RequestsPanel
            row={{ requests: value.requests, requestErrors: value.errors }}
            onAnswer={answer}
            onOpenChat={openChat}
          />
        ) : null}
        {!value && !error ? <Text>Loading requests…</Text> : null}
      </Stack>
    </ScrollArea>
  );
}

function TicketRequestsRoot(props: { host: GuestHost; propsStore: PropsStore<HostProps> }) {
  const { host, propsStore } = props;
  const [client] = useState(() => createWebviewClient<TicketRequestsCommands>(host));
  const scope = useWebviewScope(client.queries);
  const { resource } = useSyncExternalStore(propsStore.subscribe, propsStore.get);
  if (!resource) return <Text p="md">Open a ticket to read its requests.</Text>;
  return (
    <TicketRequests key={JSON.stringify([scope, resource.type, resource.id])} client={client} resource={resource} />
  );
}

export default defineExtensionView<HostProps>({
  render({ mount, host, propsStore }) {
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <TicketRequestsRoot host={host} propsStore={propsStore} />
      </ChakraProvider>,
    );
    return () => {
      root.unmount();
      createWebviewQueryClient(host).dispose();
    };
  },
});
