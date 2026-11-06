import { Box, HStack, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
import { SessionDeviceMenu, type SessionDeviceOption } from "./session-device-menu";
import { SessionWorkspaceMenu } from "./session-workspace-menu";

const workspace: DashboardWorkspaceOption = {
  id: "workspace",
  title: "feature/panel-colors",
  shorthand: "WS-1",
  branch: "feature/panel-colors",
  type: "worktree",
  isDefault: false,
  executionKind: "local",
  providerState: "ready",
  supportsFiles: true,
  supportsDiff: true,
  supportsDelete: true,
  workspacePath: "/workspace/project",
  updatedAt: "2026-01-01T00:00:00Z",
};
const thisDevice = { id: "this-device", name: "This device", current: true };
const laptop = { id: "laptop", name: "Laptop" };

const Header = (props: { device: SessionDeviceOption; locked: boolean }) => (
  <ChatWorkspaceHub
    additions={12}
    deletions={3}
    workspaceControl={
      <HStack gap="2xs" minW="0">
        <SessionDeviceMenu devices={[props.device]} selectedDeviceId={props.device.id} isDisabled={props.locked} />
        <SessionWorkspaceMenu
          workspaces={[workspace]}
          selectedWorkspaceId={workspace.id}
          selectedWorkspaceLabel={workspace.title}
          onSelectWorkspace={() => {}}
          onOpenWorkspace={() => {}}
          isDisabled={props.locked}
        />
      </HStack>
    }
  />
);

const meta = {
  title: "Product/Sessions/Device selector",
  component: SessionDeviceMenu,
  args: { devices: [thisDevice], selectedDeviceId: thisDevice.id },
  render: () => (
    <Stack p="md" gap="md" bg="bg.muted">
      <Box data-testid="new-session">
        <Header device={thisDevice} locked={false} />
      </Box>
      <Box data-testid="this-device">
        <Header device={thisDevice} locked />
      </Box>
      <Box data-testid="other-device">
        <Header device={laptop} locked />
      </Box>
    </Stack>
  ),
} satisfies CanvasMeta<typeof SessionDeviceMenu>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const NewAndExistingSessions: Story = {
  id: "modules-sessions-device-selector--new-and-existing-sessions",
};
export const Dark: Story = {
  id: "modules-sessions-device-selector--dark",
};
