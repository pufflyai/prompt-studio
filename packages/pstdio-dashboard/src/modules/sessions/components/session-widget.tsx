import { Box, Flex } from "@chakra-ui/react";
import { useWorkbenchStore, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import {
  dashboardActiveResourceIdContextKey,
  dashboardActiveResourceKindContextKey,
} from "@/shared/extensions/workbench-extension-contributions";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";
import { DashboardSessionChatPanel, ReviewChangesAction } from "./session-chat-panel";

export const SessionWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);

  const view = resolveDashboardSessionViewForPlacement(input.instance);
  // Hide the open action when this workspace is already the active resource — you are looking at it.
  const isWorkspaceOpen = useWorkbenchStore(
    input.workbench.context.store,
    (state) =>
      state.values[dashboardActiveResourceKindContextKey] === "workspace" &&
      state.values[dashboardActiveResourceIdContextKey] === view.workspaceId,
  );

  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      emptyStateTitle="No active conversations"
      emptyStateDescription="Start a conversation to see messages here."
      // The hub frames every session; the open action only appears when there is a workspace to open
      // and it is not already the active resource.
      workspaceAction={
        view.workspaceId && !isWorkspaceOpen ? <ReviewChangesAction input={input} view={view} /> : undefined
      }
    />
  );
};

export const SessionViewWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;

  return (
    <Flex h="full" minH="0" w="full" bg="bg" overflow="hidden" px="sm" py="sm" justify="center">
      <Box h="full" minH="0" w="full" maxW="52rem">
        <SessionWidget input={input} />
      </Box>
    </Flex>
  );
};
