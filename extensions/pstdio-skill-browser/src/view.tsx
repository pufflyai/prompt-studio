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
import { SkillMenu } from "./skill-menu";
import { useSkillSelection } from "./use-skill-selection";

interface HostProps {
  projectId: string;
  resource?: ResourceRef;
}
const SkillContent = (props: { context: ExtensionViewRenderContext<HostProps>; name?: string }) => {
  const { context, name } = props;
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const selectedPath = useSyncExternalStore(client.page.subscribe, () => client.page.params().file);
  const query = useWebviewCommandQuery(
    client.commands.read.query(name ? { name } : {}, {
      events: [viewDataEvents.extensionCatalogChanged, viewDataEvents.resourcesChanged],
    }),
    visible,
  );
  const selection = useSkillSelection(client.navigation, query.data, visible && !name);
  if (query.error || selection.error)
    return (
      <Flex p="md" gap="md" align="center">
        <Text role="alert">{String(query.error || selection.error)}</Text>
        <Button
          onClick={() => {
            if (selection.error) selection.retry();
            else query.refresh();
          }}
        >
          {context.t("actions.retry", "Retry")}
        </Button>
      </Flex>
    );
  if (query.data === null)
    return (
      <Text p="md" color="fg.muted">
        {context.t("skills.empty", "No skills available.")}
      </Text>
    );
  if (query.data === undefined)
    return (
      <Flex p="md" role="status">
        <Spinner />
      </Flex>
    );
  if (name) return <SkillMenu skill={query.data} path={selectedPath} navigation={client.navigation} t={context.t} />;
  return <Spinner m="md" aria-label={context.t("skill.opening", "Opening skill")} />;
};
const App = (props: { context: ExtensionViewRenderContext<HostProps> }) => {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  return (
    <SkillContent
      key={`${hostProps.projectId}:${hostProps.resource?.id ?? ""}`}
      context={context}
      name={hostProps.resource?.id}
    />
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
