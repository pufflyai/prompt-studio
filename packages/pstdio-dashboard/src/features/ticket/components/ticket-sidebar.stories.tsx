import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { TicketSidebar } from "./ticket-sidebar";

const workspaces: TicketAttempt[] = [
  {
    id: "workspace-1",
    label: "Workspace 1",
    attemptStatusId: null,
    sessionStatus: "completed",
    shorthand: "PS-13_A1",
    updatedAt: "2026-04-10T10:00:00.000Z",
    worktreePath: "/tmp/ws1",
  },
  {
    id: "workspace-2",
    label: "Workspace 2",
    attemptStatusId: null,
    sessionStatus: "completed",
    shorthand: "PS-13_A2",
    updatedAt: "2026-04-10T11:00:00.000Z",
    worktreePath: "/tmp/ws2",
  },
];

const sessionsByWorkspaceId = new Map<string, WorkspaceSessionEntry[]>([
  [
    "workspace-1",
    [
      {
        id: "session-1",
        title: "Run validation",
        status: "completed",
        agent: "opencode",
        createdAt: "2026-04-10T10:10:00.000Z",
      },
      {
        id: "session-2",
        title: "Fix lint issue",
        status: "in_progress",
        agent: "opencode",
        createdAt: "2026-04-10T10:20:00.000Z",
      },
    ],
  ],
]);

const meta: Meta<typeof TicketSidebar> = {
  title: "Ticket/TicketSidebar",
  component: TicketSidebar,
  parameters: { layout: "padded" },
  args: {
    header: null,
    footer: null,
  },
};

export default meta;

type Story = StoryObj<typeof TicketSidebar>;

export const WorkspaceSessionsWithCreateAction: Story = {
  render: (args) => (
    <Box maxW="260px">
      <TicketSidebar
        {...args}
        files={[]}
        selectedFileId="ticket"
        workspaces={workspaces}
        sessionsByWorkspaceId={sessionsByWorkspaceId}
        selectedWorkspaceId="workspace-1"
        onSelectFile={() => undefined}
        onSelectWorkspace={() => undefined}
        onSelectSession={() => undefined}
        onCreateWorkspaceSessionDraft={() => undefined}
        onSelectPlanning={() => undefined}
      />
    </Box>
  ),
};

export const WithSubTickets: Story = {
  render: (args) => (
    <Box maxW="260px">
      <TicketSidebar
        {...args}
        files={[]}
        subTickets={[
          { id: "ticket-2", shorthand: "PS-13", title: "Set up retries", statusId: null },
          { id: "ticket-3", shorthand: "PS-14", title: "Add smoke checks", statusId: null },
        ]}
        knownSubTicketIds={["ticket-2", "ticket-3"]}
        selectedFileId="ticket"
        workspaces={workspaces}
        sessionsByWorkspaceId={sessionsByWorkspaceId}
        selectedWorkspaceId="workspace-1"
        onSelectFile={() => undefined}
        onSelectSubTicket={() => undefined}
        onSelectWorkspace={() => undefined}
        onSelectSession={() => undefined}
        onCreateWorkspaceSessionDraft={() => undefined}
        onSelectPlanning={() => undefined}
      />
    </Box>
  ),
};

export const WithoutSubTickets: Story = {
  render: (args) => (
    <Box maxW="260px">
      <TicketSidebar
        {...args}
        files={[]}
        subTickets={[]}
        knownSubTicketIds={[]}
        selectedFileId="ticket"
        workspaces={workspaces}
        sessionsByWorkspaceId={sessionsByWorkspaceId}
        selectedWorkspaceId="workspace-1"
        onSelectFile={() => undefined}
        onSelectSubTicket={() => undefined}
        onSelectWorkspace={() => undefined}
        onSelectSession={() => undefined}
        onCreateWorkspaceSessionDraft={() => undefined}
        onSelectPlanning={() => undefined}
      />
    </Box>
  ),
};
