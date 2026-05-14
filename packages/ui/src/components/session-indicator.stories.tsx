import { HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { SessionIndicator } from "./session-indicator";

const meta: Meta<typeof SessionIndicator> = {
  title: "Components/SessionIndicator",
  component: SessionIndicator,
};

export default meta;

type Story = StoryObj<typeof SessionIndicator>;

export const InProgress: Story = {
  args: { status: "in_progress" },
};

export const AwaitingInput: Story = {
  args: { status: "awaiting_input" },
};

export const Completed: Story = {
  args: { status: "completed" },
};

export const Failed: Story = {
  args: { status: "failed" },
};

export const Cancelled: Story = {
  args: { status: "cancelled" },
};

export const Disconnected: Story = {
  args: { status: "disconnected" },
};

export const Undefined: Story = {
  args: {},
};

export const AllStatuses: Story = {
  render: () => (
    <HStack gap="md">
      {(
        [
          "in_progress",
          "awaiting_input",
          "queued",
          "completed",
          "failed",
          "cancelled",
          "disconnected",
          undefined,
        ] as const
      ).map((status) => (
        <HStack key={status ?? "undefined"} gap="xs">
          <SessionIndicator status={status} />
          <Text textStyle="label/S/regular">{status ?? "undefined"}</Text>
        </HStack>
      ))}
    </HStack>
  ),
};
