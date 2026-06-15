import { Box, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type BackendConnectionStatus, BackendConnectionStatusBadge } from "./backend-connection-dot";

const StatusBarFrame = (props: { status: BackendConnectionStatus }) => {
  const { status } = props;

  return (
    <Box bg="bg.panel" borderColor="border.muted" borderWidth="1px" h="1.75rem" w="18rem">
      <HStack h="full" justify="flex-end" px="sm">
        <BackendConnectionStatusBadge status={status} />
      </HStack>
    </Box>
  );
};

const meta: Meta<typeof StatusBarFrame> = {
  title: "Sync/BackendConnectionStatusBadge",
  component: StatusBarFrame,
  parameters: { layout: "padded" },
  args: {
    status: "connected",
  },
};

export default meta;

type Story = StoryObj<typeof StatusBarFrame>;

export const Connected: Story = {
  args: {
    status: "connected",
  },
};

export const Connecting: Story = {
  args: {
    status: "connecting",
  },
};

export const Disconnected: Story = {
  args: {
    status: "error",
  },
};
