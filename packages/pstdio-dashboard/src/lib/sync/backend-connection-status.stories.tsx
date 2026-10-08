import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { BackendConnectionStatus } from "./backend-connection-status";

const ConnectionStatus = () => {
  const [connected, setConnected] = useState(false);
  return (
    <Stack gap="md">
      <Box as="footer" bg="bg" h="7" display="flex" alignItems="center" justifyContent="flex-end" px="sm">
        <BackendConnectionStatus connected={connected} />
      </Box>
      <Button size="sm" onClick={() => setConnected(!connected)}>
        {connected ? "Disconnect" : "Reconnect"}
      </Button>
    </Stack>
  );
};

const meta = {
  title: "Sync/Backend connection status",
  component: BackendConnectionStatus,
  args: { connected: false },
  parameters: { layout: "padded" },
} satisfies Meta<typeof BackendConnectionStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).not.toHaveTextContent(/^$/);
  },
};
export const Connected: Story = {
  args: { connected: true },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toHaveTextContent(/^$/);
    await userEvent.tab();
    await expect(status).toHaveFocus();
    const tooltip = await within(document.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent(status.getAttribute("aria-label") ?? "");
  },
};
export const Recovered: Story = {
  render: () => <ConnectionStatus />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reconnect" }));
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent(/^$/);
    await expect(canvas.queryByRole("status", { name: /connection lost/i })).not.toBeInTheDocument();
  },
};
