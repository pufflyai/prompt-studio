import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SessionChat } from "./session-chat";

// The keep-alive session chat renderer in isolation. In the workbench it is
// registered with `keepAlive: true` so the same subtree moves between the
// attached panel and the floating bubble without losing state.
const meta = {
  title: "Dashboard Workbench/Session Chat",
  component: SessionChat,
} satisfies Meta<typeof SessionChat>;

export default meta;

export const KeepAliveAssistant: StoryObj<typeof SessionChat> = {
  render: () => (
    <Box h="600px" w="420px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
      <SessionChat />
    </Box>
  ),
};
