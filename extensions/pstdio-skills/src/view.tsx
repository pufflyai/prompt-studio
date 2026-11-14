import "@pstdio/ui/style.css";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
  viewDataEvents,
} from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, FileIconThemePreferenceProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./browser";
import { SkillViewerContent } from "./skill-viewer";

interface HostProps {
  projectId: string;
  resource?: ResourceRef;
}
const SkillContent = (props: { context: ExtensionViewRenderContext<HostProps>; name: string }) => {
  const { context, name } = props;
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const query = useWebviewCommandQuery(
    client.commands.read.query(
      { name },
      {
        events: [viewDataEvents.extensionCatalogChanged, viewDataEvents.resourcesChanged],
      },
    ),
    visible,
  );
  if (query.error)
    return (
      <Flex p="md" gap="md" align="center">
        <Text role="alert">{String(query.error)}</Text>
        <Button onClick={() => query.refresh()}>Retry</Button>
      </Flex>
    );
  if (!query.data)
    return (
      <Flex p="md" role="status">
        <Spinner />
      </Flex>
    );
  return <SkillViewerContent key={query.data.id} skill={query.data} />;
};
const App = (props: { context: ExtensionViewRenderContext<HostProps> }) => {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  return hostProps.resource ? (
    <SkillContent
      key={`${hostProps.projectId}:${hostProps.resource.id}`}
      context={context}
      name={hostProps.resource.id}
    />
  ) : (
    <Text p="md" color="fg.muted">
      Select a skill in the sidebar.
    </Text>
  );
};
export default defineExtensionView<HostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <FileIconThemePreferenceProvider>
          <Box h="100dvh" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
            <App context={context} />
          </Box>
        </FileIconThemePreferenceProvider>
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
