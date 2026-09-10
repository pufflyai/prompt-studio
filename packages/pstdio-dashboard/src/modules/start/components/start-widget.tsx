import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import {
  useWorkbenchStore,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
  type WorkbenchPanelRenderInput,
} from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "@/shared/app/project-context";
import { type RecentProjectResource, readRecentProjectResources } from "@/shared/recents/recent-project-resources";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { StartAboutPanel } from "./start-about-panel";
import { type StartAction, StartActionList } from "./start-action-list";
import { StartRecentList } from "./start-recent-list";

const dashboardExtensionsSettingsPanelId = "extensions";

const useContextString = (input: WorkbenchPanelRenderInput, key: string) =>
  useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[key];
    return typeof value === "string" ? value : undefined;
  });

export const StartWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = useContextString(input, dashboardSelectedProjectIdContextKey);
  const projectName = useContextString(input, dashboardSelectedProjectNameContextKey);
  const dashboardDataVersion = useSyncExternalStore(
    subscribeDashboardData,
    getDashboardDataVersion,
    getDashboardDataVersion,
  );
  const recentResources = readRecentProjectResources(projectId, dashboardDataVersion);

  const actions: StartAction[] = [
    {
      id: "new-conversation",
      label: "New conversation",
      icon: "message-square",
      run: () => void input.workbench.commands.executeCommand(dashboardCommandIds.createSession),
    },
    {
      id: "open-tool",
      label: "Open a tool",
      icon: "panels-top-left",
      run: () => void input.workbench.commands.executeCommand(dashboardCommandIds.openCommandPalette),
    },
    {
      id: "browse-extensions",
      label: "Browse extensions",
      icon: "blocks",
      run: () =>
        void input.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, {
          panelId: dashboardExtensionsSettingsPanelId,
        }),
    },
  ];

  const openResource = (resource: RecentProjectResource) => {
    openSessionsPage(input.workbench, resource.resource);
  };

  return (
    <Flex h="full" minH="0" w="full" bg="bg" overflow="auto" data-testid="start-page">
      <Stack w="full" maxW="52rem" mx="auto" px={{ base: "md", md: "lg" }} pt="4xl" pb="3xl" gap="3xl">
        <Stack gap="xs" minW="0">
          <Text textStyle="heading/M">{projectName ?? "Project"}</Text>
          <Text textStyle="paragraph/M/regular" color="fg.muted">
            Project home
          </Text>
        </Stack>
        <StartAboutPanel />
        <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
          <Box flex="1" minW="0" w="full">
            <StartActionList actions={actions} />
          </Box>
          <Box flex="1" minW="0" w="full">
            <StartRecentList resources={recentResources} onOpen={openResource} />
          </Box>
        </Stack>
      </Stack>
    </Flex>
  );
};
