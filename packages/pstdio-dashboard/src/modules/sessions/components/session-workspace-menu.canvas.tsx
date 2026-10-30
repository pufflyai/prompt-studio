import { Box, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
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
const meta = {
  title: "Modules/Sessions/Workspace selector",
  component: SessionWorkspaceMenu,
  args: {
    workspaces: [workspace],
    selectedWorkspaceId: workspace.id,
    selectedWorkspaceLabel: workspace.title,
    onSelectWorkspace: () => {},
    onOpenWorkspace: () => {},
  },
  render: (args) => (
    <Stack p="md" gap="md" bg="bg.muted">
      <Box data-testid="editable">
        <SessionWorkspaceMenu {...args} />
      </Box>
      <Box data-testid="locked">
        <SessionWorkspaceMenu {...args} isDisabled />
      </Box>
    </Stack>
  ),
} satisfies CanvasMeta<typeof SessionWorkspaceMenu>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const EditableAndLocked: Story = {
  id: "modules-sessions-workspace-selector--editable-and-locked",
};
