import { Box } from "@chakra-ui/react";
import { DataTable } from "@pstdio/ui/data-table";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

const meta: Meta<typeof DataTable> = {
  title: "Workspaces/RemoteWorkspaceStatus",
  component: DataTable,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const ProviderFailure: Story = {
  render: () => (
    <Box p="sm" height="480px">
      <DataTable
        data={[
          {
            Attempt: "REMOTE-1",
            Name: "Remote workspace",
            Type: "Current branch",
            Provider: "example.remote-execution.workspace-type.remote",
            State: "Failed",
            Location: "remote://runner-42/workspace",
            "Provider error": "Remote container failed to start",
          },
        ]}
        toolbarStorageKey="storybook-remote-workspace-status"
        fullWidth
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
