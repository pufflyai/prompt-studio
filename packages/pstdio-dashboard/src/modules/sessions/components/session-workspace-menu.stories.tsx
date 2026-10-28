import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  tags: ["locked-workspace"],
  component: SessionWorkspaceMenu,
  args: {
    workspaces: [workspace],
    selectedWorkspaceId: workspace.id,
    selectedWorkspaceLabel: workspace.title,
    onSelectWorkspace: () => {},
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = within(canvas.getByTestId("editable")).getByRole("button", { name: "Select workspace" });
    const locked = within(canvas.getByTestId("locked")).getByRole("button", { name: "Select workspace" });
    await expect(locked).toBeDisabled();
    for (const property of ["height", "width", "paddingLeft", "paddingRight", "gap"] as const) {
      await expect(getComputedStyle(locked)[property]).toBe(getComputedStyle(editable)[property]);
    }
    const background = getComputedStyle(locked).backgroundColor;
    await userEvent.hover(canvas.getByTestId("locked"));
    await expect(getComputedStyle(locked).backgroundColor).toBe(background);
    await userEvent.click(editable);
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).getByTestId("session-workspace-options")).toBeVisible(),
    );
  },
} satisfies Meta<typeof SessionWorkspaceMenu>;

export default meta;
type Story = StoryObj<typeof meta>;
export const EditableAndLocked: Story = {};
