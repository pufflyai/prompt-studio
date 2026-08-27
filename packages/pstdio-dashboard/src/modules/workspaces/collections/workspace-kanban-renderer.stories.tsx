import { Box } from "@chakra-ui/react";
import { KanbanRenderer } from "@pstdio/ui/kanban-renderer";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { workspaceAttributes, workspaceDefaultSettings } from "./workspace-kanban-renderer";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Workspaces/RemoteWorkspaceStatus",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const ProviderFailure: Story = {
  render: () => (
    <Box p="sm" height="480px">
      <KanbanRenderer
        rows={[
          {
            id: "workspace-remote",
            title: "Remote workspace",
            attributes: {
              id: "REMOTE-1",
              type: "current_branch",
              provider: "example.remote-execution.workspace-type.remote",
              state: "failed",
              location: "remote://runner-42/workspace",
              error: "Remote container failed to start",
              created: "2026-08-27T08:00:00.000Z",
              updated: "2026-08-27T08:01:00.000Z",
            },
          },
        ]}
        storageKey="storybook-remote-workspace-status"
        attributes={workspaceAttributes}
        defaultSettings={workspaceDefaultSettings}
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("example.remote-execution.workspace-type.remote")).toBeVisible();
    await expect(canvas.getByText("Failed")).toBeVisible();
    await expect(canvas.getByText("remote://runner-42/workspace")).toBeVisible();
    await expect(canvas.getByText("Remote container failed to start")).toBeVisible();
  },
};
