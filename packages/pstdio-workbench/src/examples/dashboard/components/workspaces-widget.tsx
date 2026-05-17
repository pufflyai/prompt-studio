import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea, WorkspaceBadge, type WorkspaceBadgeProps } from "@pstdio/ui";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { useWorkbenchStore, WorkbenchIcon } from "../../../react";
import { dashboardMockChatMessages, dashboardTickets } from "../mock-data/data";
import { WebviewPlaceholder } from "./webview-placeholder";
import { WorkspaceDetailTabs } from "./workspace-detail-tabs";

type DashboardTicket = (typeof dashboardTickets)[number];

const toSessionStatus = (status: string): WorkspaceBadgeProps["sessionStatus"] => {
  if (
    status === "in_progress" ||
    status === "awaiting_input" ||
    status === "queued" ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "disconnected"
  ) {
    return status;
  }

  return undefined;
};

const WorkspaceRowBadge = (props: { ticket: DashboardTicket }) => {
  const { ticket } = props;

  return (
    <WorkspaceBadge
      workspaceType={ticket.workspace.type === "worktree" ? "worktree" : "current_branch"}
      shorthand={ticket.workspace.shorthand}
      attemptStatus={ticket.workspace.status}
      sessionStatus={toSessionStatus(ticket.workspace.sessionStatus)}
      diffAdditions={ticket.workspace.additions}
      diffDeletions={ticket.workspace.deletions}
      hasMultipleWorkspaces
    />
  );
};

export const WorkspaceListWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeResourceUri = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.activeResourceUri);

  return (
    <Stack h="full" minH="0" gap="0" bg="bg">
      <HStack px="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted" flexShrink={0}>
        <WorkbenchIcon name="GitBranch" size={14} />
        <Text textStyle="label/S/medium">Workspaces</Text>
        <Badge size="sm" variant="outline">
          {dashboardTickets.length}
        </Badge>
      </HStack>
      <ScrollArea flex="1" minH="0" contentProps={{ py: "xs" }}>
        {dashboardTickets.map((ticket) => (
          <ListRow
            key={ticket.workspaceResource.uri}
            id={ticket.workspaceResource.uri}
            label={`${ticket.id} Attempt ${ticket.workspace.shorthand}`}
            variant="tree"
            icon={<WorkbenchIcon name="GitBranch" size={14} />}
            endContent={<WorkspaceRowBadge ticket={ticket} />}
            isSelected={activeResourceUri === ticket.workspaceResource.uri}
            onActivate={() => {
              void input.workbench.resources.openResource(ticket.workspaceResource, { replaceActive: true });
            }}
          />
        ))}
      </ScrollArea>
    </Stack>
  );
};

export const WorkspacesOverviewWidget = () => (
  <Box h="full" minH="0" p="md">
    <WebviewPlaceholder
      slotId="workspaces.overview"
      title="/projects/acme/workspaces"
      contributor="pstdio"
      entry="workspaces-page.tsx"
      icon="GitBranch"
      height="100%"
    />
  </Box>
);

export const WorkspacePageWidget = () => (
  <Stack h="full" minH="0" minW="0" gap="0" bg="bg.subtle">
    <WorkspaceDetailTabs />
  </Stack>
);

export const SessionsOverviewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Box h="full" minH="0">
      <ChatPanel
        conversationKey="dashboard-workbench-sessions"
        messages={dashboardMockChatMessages}
        streaming
        emptyStateTitle="No sessions"
        emptyStateDescription="Start a workspace session from a ticket."
        chatInputPlaceholder="Message this session..."
        attachedResources={["PS-294", "Attempt A1"]}
        workspaceHub={
          <ChatWorkspaceHub
            changesLabel="Attempt A1"
            additions={148}
            deletions={37}
            action={
              <Button
                size="2xs"
                variant="ghost"
                onClick={() => {
                  void input.workbench.resources.openResource(dashboardTickets[0].workspaceResource, {
                    replaceActive: true,
                  });
                }}
              >
                Open workspace
              </Button>
            }
          />
        }
        onSubmitMessage={(text) =>
          input.workbench.notifications.show({ level: "success", title: `Message queued: ${text}` })
        }
      />
    </Box>
  );
};
