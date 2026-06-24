import { Box, HStack, Text } from "@chakra-ui/react";
import type { Meta } from "@storybook/react";
import type { ReactNode } from "react";
import { NotificationBadge } from "./notification-badge";

type StoryFn = () => ReactNode;

const meta: Meta<typeof NotificationBadge> = {
  title: "Components/Notifications/Badge",
  component: NotificationBadge,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="md" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Variants = {
  render: () => (
    <HStack gap="md">
      {[0, 1, 5, 12, 99, 100, 250].map((count) => (
        <HStack key={count} gap="2">
          <Text textStyle="small">{count}</Text>
          <NotificationBadge count={count} />
        </HStack>
      ))}
    </HStack>
  ),
};
