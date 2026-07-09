import { Box, Flex } from "@chakra-ui/react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";
import { shouldShowSessionWorkspaceHub } from "../data/session-workspace-hub-visibility";
import { DashboardSessionChatPanel, ReviewChangesAction } from "./session-chat-panel";

export const SessionWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const activeModeId = useWorkbenchStore(input.workbench.modes.store, (state) => state.activeModeId);

  const view = resolveDashboardSessionViewForPlacement(input.placement);
  const showWorkspaceHub = shouldShowSessionWorkspaceHub({
    sessionId: view.sessionId,
    workspaceId: view.workspaceId,
    activeModeId,
  });

  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Pick a session to open the conversation."
      workspaceAction={<ReviewChangesAction input={input} view={view} />}
      showWorkspaceHub={showWorkspaceHub}
    />
  );
};

export const SessionViewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Flex h="full" minH="0" w="full" bg="bg" overflow="hidden" px="sm" py="sm" justify="center">
      <Box h="full" minH="0" w="full" maxW="52rem">
        <SessionWidget input={input} />
      </Box>
    </Flex>
  );
};
