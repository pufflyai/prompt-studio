import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { BackendConnectionStatus } from "./backend-connection-status";

const ConnectionStatus = () => {
  const [connected, setConnected] = useState(false);
  return (
    <Stack gap="md">
      <Box as="footer" bg="bg" h="xl" display="flex" alignItems="center" justifyContent="flex-end" px="sm">
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
} satisfies CanvasMeta<typeof BackendConnectionStatus>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Disconnected: Story = {
  id: "sync-backend-connection-status--disconnected",
};
export const Connected: Story = {
  id: "sync-backend-connection-status--connected",
  args: { connected: true },
};
export const Recovered: Story = {
  id: "sync-backend-connection-status--recovered",
  render: () => <ConnectionStatus />,
};
