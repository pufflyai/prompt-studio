import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Header, ListRow, PanelLayout, ScrollArea, WorkspaceBadge, type WorkspaceBadgeProps } from "@pstdio/ui";
import { Bot, FileText } from "lucide-react";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { WorkbenchIcon } from "../../../react";
import { dashboardTickets, dashboardWidgetIds } from "../mock-data/data";
import { WorkspaceDetailTabs } from "./workspace-detail-tabs";

type DashboardTicket = (typeof dashboardTickets)[number];

const resolveTicket = (input: WorkbenchWidgetRenderInput) => {
  const resourceId = input.placement.resource?.id;
  return dashboardTickets.find((ticket) => ticket.id === resourceId) ?? dashboardTickets[0];
};

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

const TicketSidebar = (props: { input: WorkbenchWidgetRenderInput; ticket: DashboardTicket }) => {
  const { input, ticket } = props;

  return (
    <Stack h="full" minH="0" w="full" gap="0" bg="bg">
      <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted">
        <HStack minW="0" gap="xs">
          <WorkbenchIcon name="Ticket" size={14} />
          <Text textStyle="label/S/medium" truncate>
            {ticket.id}
          </Text>
        </HStack>
      </Header>
      <ScrollArea flex="1" minH="0" contentProps={{ p: "xs", spaceY: "md" }}>
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.muted" px="2xs">
            Files
          </Text>
          {["ticket.md", "planning.md", "packages/pstdio-dashboard/src/features/project/pages/project-shell.tsx"].map(
            (file) => (
              <ListRow
                key={file}
                id={file}
                label={file}
                variant="tree"
                icon={<FileText size={14} />}
                onActivate={() => input.workbench.notifications.show({ level: "info", title: `Opened ${file}` })}
              />
            ),
          )}
        </Stack>
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.muted" px="2xs">
            Workspaces
          </Text>
          <ListRow
            id={ticket.workspace.shorthand}
            label={`Attempt ${ticket.workspace.shorthand}`}
            variant="tree"
            icon={<WorkbenchIcon name="GitBranch" size={14} />}
            onActivate={() => {
              void input.workbench.resources.openResource(ticket.workspaceResource, { replaceActive: true });
            }}
            endContent={
              <WorkspaceBadge
                workspaceType={ticket.workspace.type === "worktree" ? "worktree" : "current_branch"}
                shorthand={ticket.workspace.shorthand}
                attemptStatus={ticket.workspace.status}
                sessionStatus={toSessionStatus(ticket.workspace.sessionStatus)}
                diffAdditions={ticket.workspace.additions}
                diffDeletions={ticket.workspace.deletions}
                hasMultipleWorkspaces
              />
            }
          />
        </Stack>
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.muted" px="2xs">
            Sessions
          </Text>
          <ListRow
            id="claude-code-session"
            label="Claude Code"
            description="Running workbench migration"
            variant="tree"
            icon={<Bot size={14} />}
            onActivate={() => input.workbench.layout.openWidget(dashboardWidgetIds.session, { pinned: true })}
          />
        </Stack>
      </ScrollArea>
    </Stack>
  );
};

export const WorkspaceWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const ticket = resolveTicket(input);

  return (
    <PanelLayout sidebar={<TicketSidebar input={input} ticket={ticket} />}>
      <Stack flex="1" gap="0" minH="0" minW="0" bg="bg">
        <Flex flex="1" minH="0" minW="0" bg="bg.subtle">
          <WorkspaceDetailTabs />
        </Flex>
      </Stack>
    </PanelLayout>
  );
};
