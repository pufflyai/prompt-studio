import "@pstdio/ui/style.css";
import { Box, Button, Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  getCommandValue,
  sessionBrowser,
  workbenchCommands,
} from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { Activity, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { HomeQuotas } from "./components/home-quotas";
import { ProjectSetupStatus } from "./components/project-setup-status";
import { StartAboutPanel } from "./components/start-about-panel";
import { StartActionList } from "./components/start-action-list";
import { StartRecentList } from "./components/start-recent-list";
import type { readHome } from "./data";
import { type RecentProjectResource, recentProjectResources } from "./recent-resources";
import { subscribeHome } from "./subscriptions";

type HomeData = Awaited<ReturnType<typeof readHome>> & { recent: RecentProjectResource[] };
interface HostProps {
  projectId: string;
}
interface AppProps {
  context: ExtensionViewRenderContext<HostProps>;
}

const HomeApp = (props: AppProps) => {
  const { context } = props;
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  const [data, setData] = useState<HomeData>();
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState<string>();
  const [actionError, setActionError] = useState<{ id: string; message: string }>();
  const [pending, setPending] = useState<string>();
  useEffect(() => subscribeHome(client.events, () => setRefresh((value) => value + 1)), [client]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: host events invalidate the query.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      client.commands.read(),
      context.host.call("commands.execute", { commandId: workbenchCommands.recentResources.id, params: {} }),
    ])
      .then(([value, recent]) => {
        if (!cancelled) {
          const resources = getCommandValue(recent.outcome) as NonNullable<
            typeof workbenchCommands.recentResources.result
          >;
          setData({ ...value, recent: recentProjectResources(resources) });
          setLoadError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [client, context.host, refresh]);
  const run = async (id: string, commandId: string, params = {}) => {
    setPending(id);
    setActionError(undefined);
    try {
      const response = await context.host.call("commands.execute", { commandId, params });
      if (!response.outcome.ok) throw new Error(response.outcome.reason);
      if (id === "retry") setRefresh((value) => value + 1);
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
              <Button onClick={() => setRefresh((value) => value + 1)}>Retry</Button>
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
        <HomeQuotas client={client} />
        <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
          <Box flex="1" minW="0" w="full">
            <StartActionList actions={actions} pending={pending} error={actionError} />
          </Box>
          <Box flex="1" minW="0" w="full">
            <StartRecentList
              resources={data?.recent ?? []}
              onOpen={(recent) => {
                void context.host
                  .call("navigation.open", {
                    target: recent.target,
                  })
                  .catch((error) => setLoadError(String(error)));
              }}
            />
          </Box>
        </Stack>
      </Stack>
    </ScrollArea>
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
        <HomeApp key={hostProps.projectId} context={context} />
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
