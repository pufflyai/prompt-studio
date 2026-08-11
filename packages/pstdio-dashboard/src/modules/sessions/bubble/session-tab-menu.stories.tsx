import { Button, Menu, Portal } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDown } from "lucide-react";
import { createDashboardResource } from "@/shared/app/resources";
import type { DashboardSession } from "../data/dashboard-sessions";
import { SessionTabMenuView } from "./session-tab";

const createSession = (input: { id: string; title: string; status: string }): DashboardSession => ({
  id: input.id,
  title: input.title,
  status: input.status,
  agent: null,
  lastSelectedModel: null,
  updatedAt: "2026-07-26T10:00:00.000Z",
  lastActivityAt: "2026-07-26T10:00:00.000Z",
  workspaceId: null,
  workspaceBranch: null,
  workspaceShorthand: "",
  ticketId: null,
  resource: createDashboardResource("session", input.id, input.title, "MessageCircle", "project", {
    status: input.status,
  }),
});

const manySessions: DashboardSession[] = [
  createSession({
    id: "s-1",
    title: "Investigate the intermittent packaged-serve smoke-test failure on CI runners",
    status: "in_progress",
  }),
  createSession({ id: "s-2", title: "Render create forms from the full param vocabulary", status: "completed" }),
  createSession({ id: "s-3", title: "Keep project switching responsive", status: "completed" }),
  createSession({ id: "s-4", title: "Expose workspace IDs in CLI listings", status: "failed" }),
  createSession({ id: "s-5", title: "Keep shipped diagnostics and docs self-contained", status: "cancelled" }),
  createSession({ id: "s-6", title: "Should never appear - beyond the five-latest limit", status: "queued" }),
  createSession({ id: "s-7", title: "Also hidden by the limit", status: "disconnected" }),
];

const MenuSurface = (props: { sessions: DashboardSession[]; selectedSessionId?: string }) => (
  <Menu.Root defaultOpen>
    <Menu.Trigger asChild>
      <Button variant="outline">
        Session tab
        <ChevronDown size={14} />
      </Button>
    </Menu.Trigger>
    <Portal>
      <Menu.Positioner>
        <Menu.Content minW="18.75rem" bg="bg">
          <SessionTabMenuView
            sessions={props.sessions}
            selectedSessionId={props.selectedSessionId}
            onNewSession={() => undefined}
            onSelectSession={() => undefined}
            onViewAllSessions={() => undefined}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
);

const meta: Meta<typeof SessionTabMenuView> = {
  title: "Modules/Sessions/Session Tab Menu",
  component: SessionTabMenuView,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof SessionTabMenuView>;

// A long title stays within the fixed dropdown width and truncates instead of stretching it.
export const FiveLatestFixedWidth: Story = {
  render: () => <MenuSurface sessions={manySessions} selectedSessionId="s-1" />,
};

export const Empty: Story = {
  render: () => <MenuSurface sessions={[]} />,
};
