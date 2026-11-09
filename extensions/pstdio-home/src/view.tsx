import "@pstdio/ui/style.css";
import { Box, Button, Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  sessionBrowser,
  workbenchCommands,
} from "@pstdio/sdk/extensions";
import { useScopedQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { AlertMessage, ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { Activity, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ProjectSetupStatus } from "./components/project-setup-status";
import { StartAboutPanel } from "./components/start-about-panel";
import { StartActionList } from "./components/start-action-list";
import { StartRecentList } from "./components/start-recent-list";
import { createHomeQueries } from "./home-queries";

interface HostProps {
  projectId: string;
}
interface AppProps {
  context: ExtensionViewRenderContext<HostProps>;
}

const HomeApp = (props: AppProps & HostProps) => {
  const { context, projectId } = props;
  const queries = createHomeQueries(context.host, projectId);
  const home = useScopedQuery(queries.home);
  const recent = useScopedQuery(queries.recent);
  const data = home.data;
  const [openError, setOpenError] = useState<string>();
  const loadError = home.error?.message ?? recent.error?.message ?? openError;
  const [actionError, setActionError] = useState<{ id: string; message: string }>();
  const [pending, setPending] = useState<string>();
  const refresh = () => {
    setOpenError(undefined);
    queries.home.invalidate();
    queries.recent.invalidate();
  };
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
  const browse = () => {
    void context.host
      .call("navigation.open", {
        target: { kind: "page", page: { kind: "page", extensionId: "pstdio", id: "extensions" } },
      })
      .catch((error) => setActionError({ id: "browse-extensions", message: String(error) }));
  };
  const actions = [
    {
      id: "new-conversation",
      label: "New conversation",
      icon: "message-square-plus",
      run: () => {
        void context.host
          .call("navigation.open", {
            target: { kind: "command", target: { command: sessionBrowser.commands.create, params: {} } },
          })
          .catch((error) => setActionError({ id: "new-conversation", message: String(error) }));
      },
    },
    {
      id: "open-tool",
      label: "Open a tool",
      icon: "panels-top-left",
      run: () => {
        void run("open-tool", workbenchCommands.openToolSearch.id);
      },
    },
    { id: "browse-extensions", label: "Browse extensions", icon: "blocks", run: browse },
  ];
  return (
    <ScrollArea height="100dvh" width="full" bg="bg" color="fg">
      <Stack
        w="full"
        maxW="52rem"
        mx="auto"
        px={{ base: "md", md: "lg" }}
        pt="4xl"
        pb="3xl"
        gap="3xl"
        data-testid="start-page"
      >
        <Stack gap="xs" minW="0">
          <Text textStyle="heading/M">{data?.project.name ?? "Project"}</Text>
          <Text textStyle="paragraph/M/regular" color="fg.muted">
            Project home
          </Text>
        </Stack>
        {loadError && (
          <AlertMessage status="error" title="Could not load project home">
            <Stack>
              <Text>{loadError}</Text>
              <Button onClick={refresh}>Retry</Button>
            </Stack>
          </AlertMessage>
        )}
        {(data?.setupError || actionError?.id === "retry") && (
          <ProjectSetupStatus
            error={actionError?.id === "retry" ? actionError.message : (data?.setupError ?? "")}
            retrying={pending === "retry"}
            onRetry={() => {
              void run("retry", workbenchCommands.retryProjectSetup.id);
            }}
          />
        )}
        <StartAboutPanel />
        <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
          <Box flex="1" minW="0" w="full">
            <StartActionList actions={actions} pending={pending} error={actionError} />
          </Box>
          <Box flex="1" minW="0" w="full">
            <StartRecentList
              resources={recent.data ?? []}
              onOpen={(recent) => {
                void context.host
                  .call("navigation.open", {
                    target: recent.target,
                  })
                  .catch((error) => setOpenError(String(error)));
              }}
            />
          </Box>
        </Stack>
      </Stack>
    </ScrollArea>
  );
};

const View = (props: AppProps) => {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const visible = useWebviewVisibility();
  return (
    <ChakraProvider value={psTheme}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <HomeApp key={hostProps.projectId} context={context} projectId={hostProps.projectId} />
      </Activity>
    </ChakraProvider>
  );
};
export default defineExtensionView<HostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => {
      root.unmount();
      createWebviewClient(context.host).queries.dispose();
    };
  },
});
