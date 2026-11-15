import { RequestWindowControls } from "../timeline/view/request-window";
import "@pstdio/ui/style.css";
import { Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type GuestHost,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { listReviewRequestsCommand, openReviewRequestCommand, reviewCommand } from "../commands/review-requests";
import { plannerTicketsChanged } from "../events";
import { RequestsPanel } from "../timeline/view/requests-panel";
import { useLiveValue } from "../timeline/view/use-live-value";

type Commands = {
  "review-requests.list": typeof listReviewRequestsCommand;
  review: typeof reviewCommand;
  "review-requests.open": typeof openReviewRequestCommand;
};
type Client = ReturnType<typeof createWebviewClient<Commands>>;
const read = async (client: Client, input = "") => ({
  input,
  ...(await client.commands["review-requests.list"](JSON.parse(input))),
});
const events = [plannerTicketsChanged];
interface HostProps {
  resource?: ResourceRef;
}

function TicketRequests(props: { host: GuestHost; resource: ResourceRef }) {
  const { host, resource } = props;
  const [client] = useState(() => createWebviewClient<Commands>(host));
  const [offset, setOffset] = useState(0);
  const input = JSON.stringify({ ticket: resource.id, offset });
  const { value } = useLiveValue(client, read, events, input);
  const current = value?.input === input ? value : undefined;
  return (
    <ScrollArea h="full">
      <Stack p="md" gap="md" w="full" maxW="2xl" mx="auto">
        <Text textStyle="label/L/medium">{resource.label ?? resource.shorthand}</Text>
        {current ? (
          <RequestsPanel
            row={{ requests: current.requests, requestErrors: current.errors }}
            onAnswer={(requestId, response) => client.commands.review({ requestId, response })}
            onOpenChat={(requestId) => client.commands["review-requests.open"]({ requestId })}
          />
        ) : null}
        {!current ? <Text>Loading requests…</Text> : null}
        <RequestWindowControls result={value} offset={value?.offset ?? 0} move={setOffset} loading={!current} />
      </Stack>
    </ScrollArea>
  );
}

function TicketRequestsRoot(props: { host: GuestHost; propsStore: PropsStore<HostProps> }) {
  const { host, propsStore } = props;
  const { resource } = useSyncExternalStore(propsStore.subscribe, propsStore.get);
  if (!resource) return <Text p="md">Open a ticket to read its requests.</Text>;
  return <TicketRequests key={resource.id} host={host} resource={resource} />;
}

export default defineExtensionView<HostProps>({
  render({ mount, host, propsStore }) {
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <TicketRequestsRoot host={host} propsStore={propsStore} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
