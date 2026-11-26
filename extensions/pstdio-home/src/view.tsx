import "@pstdio/ui/style.css";
import { Button, Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  workbenchCommands,
} from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { AlertMessage, ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { Activity, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { HomePromptCarousel } from "./components/home-prompt-carousel";
import { HomeWelcome } from "./components/home-welcome";
import { ProjectSetupStatus } from "./components/project-setup-status";
import { StartRecentList } from "./components/start-recent-list";
import { homeQueries } from "./home-queries";
import { recentProjectResources } from "./recent-resources";

interface HostProps {
  projectId: string;
}
interface AppProps {
  context: ExtensionViewRenderContext<HostProps>;
}

export const HomeApp = (props: AppProps) => {
  const { context } = props;
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const queries = homeQueries(client);
  const home = useWebviewCommandQuery(queries.home, visible);
  const recent = useWebviewCommandQuery(queries.recent, visible);
  const data = home.data;
  const [navigationError, setNavigationError] = useState<string>();
  const loadError = home.error || recent.error || navigationError;
  const [dismissedLoadError, setDismissedLoadError] = useState<unknown>();
  const showLoadError = Boolean(loadError && loadError !== dismissedLoadError);
  const refresh = () => {
    setNavigationError(undefined);
    setDismissedLoadError(undefined);
    home.refresh();
    recent.refresh();
  };
  const [actionError, setActionError] = useState<{ id: string; message: string }>();
  const [pending, setPending] = useState<string>();
  const run = async (id: string, commandId: string, params = {}) => {
    setPending(id);
    setActionError(undefined);
    try {
      const response = await context.host.call("commands.execute", { commandId, params });
      if (!response.outcome.ok) throw new Error(response.outcome.reason);
      if (id === "retry") refresh();
    } catch (error) {
      setActionError({ id, message: String(error) });
    } finally {
      setPending(undefined);
    }
  };
  return (
    <Stack
      w="full"
      maxW="2xl"
      mx="auto"
      px={{ base: "md", md: "lg" }}
      pt="4xl"
      pb="3xl"
      gap="2xl"
      position="relative"
      data-testid="start-page"
    >
      {showLoadError && (
        <AlertMessage
          size="sm"
          status="error"
          title="Could not load project home"
          position="absolute"
          bottom="xs"
          insetInline="sm"
          zIndex="docked"
          onClose={() => setDismissedLoadError(loadError)}
        >
          <Stack>
            <Text>{String(loadError)}</Text>
            <Button onClick={() => refresh()}>Retry</Button>
          </Stack>
        </AlertMessage>
      )}
      {!showLoadError && (data?.setupError || actionError?.id === "retry") && (
        <ProjectSetupStatus
          error={actionError?.id === "retry" ? actionError.message : (data?.setupError ?? "")}
          retrying={pending === "retry"}
          onRetry={() => {
            void run("retry", workbenchCommands.retryProjectSetup.id);
          }}
        />
      )}
      <HomeWelcome />
      <HomePromptCarousel
        onBuild={async (idea) => {
          await client.commands["build-home"]({ idea });
        }}
      />
      <StartRecentList
        resources={recentProjectResources(recent.data ?? [])}
        onOpen={(recent) => {
          void context.host
            .call("navigation.open", { target: recent.target })
            .catch((error) => setNavigationError(String(error)));
        }}
      />
    </Stack>
  );
};

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isVisible = () => !document.hidden;

const View = (props: AppProps) => {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, () => true);
  return (
    <ChakraProvider value={psTheme}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <ScrollArea h="full">
          <HomeApp key={hostProps.projectId} context={context} />
        </ScrollArea>
      </Activity>
    </ChakraProvider>
  );
};
export default defineExtensionView<HostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => root.unmount();
  },
});
