import { Box, Flex } from "@chakra-ui/react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { resolveDashboardSessionView } from "../../../modules/sessions/data/dashboard-sessions";
import { getDashboardDataVersion, subscribeDashboardData } from "../../data/dashboard-rows";
import { resolveDashboardSessionPlacementId } from "../session-placement";
import { shouldShowSessionWorkspaceHub } from "../session-workspace-hub-visibility";
import { CommandPaletteReviewAction, DashboardSessionChatPanel } from "./session-chat-panel";

export const SessionWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const activeModeId = useWorkbenchStore(input.workbench.modes.store, (state) => state.activeModeId);

  const view = resolveDashboardSessionView(resolveDashboardSessionPlacementId(input.placement));
  const showWorkspaceHub = shouldShowSessionWorkspaceHub({ workspaceId: view.workspaceId, activeModeId });

  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Pick a session to open the conversation."
      workspaceAction={<CommandPaletteReviewAction input={input} />}
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
