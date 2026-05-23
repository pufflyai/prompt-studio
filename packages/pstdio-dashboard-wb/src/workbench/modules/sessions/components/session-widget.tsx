import { Box, Flex } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import {
  getDashboardDataVersion,
  resolveDashboardSessionView,
  subscribeDashboardData,
} from "../../../data/dashboard-data";
import { resolveDashboardSessionPlacementId } from "../session-placement";
import { CommandPaletteReviewAction, DashboardSessionChatPanel } from "./session-chat-panel";

export const SessionWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);

  const view = resolveDashboardSessionView(resolveDashboardSessionPlacementId(input.placement));

  return (
    <DashboardSessionChatPanel
      input={input}
      view={view}
      emptyStateTitle="No messages yet"
      emptyStateDescription="Pick a session to open the conversation."
      workspaceAction={<CommandPaletteReviewAction input={input} />}
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
