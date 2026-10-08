import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { BackendConnectionWarning } from "./backend-connection-warning";

const ConnectionStatus = () => {
  const [connected, setConnected] = useState(false);
  return (
    <Stack gap="md">
      <Box as="footer" bg="bg" h="7" display="flex" alignItems="center" justifyContent="flex-end" px="sm">
        {!connected && <BackendConnectionWarning />}
      </Box>
      <Button size="sm" onClick={() => setConnected(!connected)}>
        {connected ? "Disconnect" : "Reconnect"}
      </Button>
    </Stack>
  );
};

const meta = {
  title: "Sync/Backend connection warning",
  component: ConnectionStatus,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ConnectionStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).not.toHaveTextContent("states.reconnecting");
  },
};
export const Recovered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reconnect" }));
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};
