import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createDashboardResource } from "@/shared/app/resources";
import { RecentSessionRow, type StartSession } from "./start-widget";

const sessionResource = (id: string, title: string, status: string) =>
  createDashboardResource("session", id, title, "MessageCircle", "project-1", { status });

const workspaceResource = (id: string, label: string) =>
  createDashboardResource("workspace", id, label, "GitBranch", "project-1", {
    workspaceId: id,
    workspaceShorthand: label,
    workspaceType: "worktree",
  });

const sessions: StartSession[] = [
  {
    id: "session-1",
    title: "Wire the recent sessions start page",
    status: "awaiting_input",
    updatedAt: "2026-06-16T14:24:00.000Z",
    workspaceShorthand: "PS-412_A1",
    resource: sessionResource("session-1", "Wire the recent sessions start page", "awaiting_input"),
    workspaceResource: workspaceResource("workspace-1", "PS-412_A1"),
  },
  {
    id: "session-2",
    title: "Fix workspace diff loading",
    status: "completed",
    updatedAt: "2026-06-15T09:10:00.000Z",
    workspaceShorthand: "PS-381_A2",
    resource: sessionResource("session-2", "Fix workspace diff loading", "completed"),
    workspaceResource: workspaceResource("workspace-2", "PS-381_A2"),
  },
  {
    id: "session-3",
    title: "Review project settings copy",
    status: "failed",
    updatedAt: "2026-06-12T17:45:00.000Z",
    workspaceShorthand: "",
    resource: sessionResource("session-3", "Review project settings copy", "failed"),
  },
];

const RecentSessionsPreview = () => (
  <Stack gap="xs" maxW="48rem">
    <Text textStyle="heading/M">Recent sessions</Text>
    <Stack gap="0">
      {sessions.map((session) => (
        <RecentSessionRow
          key={session.id}
          session={session}
          onOpenSession={() => undefined}
          onOpenWorkspace={() => undefined}
        />
      ))}
    </Stack>
  </Stack>
);

const meta: Meta<typeof RecentSessionsPreview> = {
  title: "Start/RecentSessions",
  component: RecentSessionsPreview,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof RecentSessionsPreview>;

export const Default: Story = {};
