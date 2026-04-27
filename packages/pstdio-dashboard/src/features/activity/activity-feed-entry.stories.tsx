import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ActivityFeedItem } from "./activity-feed";
import { ActivityFeedEntry } from "./activity-feed-entry";

const extensionItem: ActivityFeedItem = {
  id: "event-1",
  title: "Task reviewed",
  resourceType: "project.lab.task",
  resourceId: "task-1",
  resourceLabel: "Task 1",
  sourceExtensionId: "project.lab",
  isKnownKernelResource: false,
  createdAt: "2026-04-27T08:00:00.000Z",
};

const ticketItem: ActivityFeedItem = {
  id: "event-2",
  title: "Ticket status changed",
  resourceType: "ticket",
  resourceId: "PS-112",
  resourceLabel: "PS-112",
  sourceExtensionId: null,
  isKnownKernelResource: true,
  createdAt: "2026-04-27T08:05:00.000Z",
};

const meta: Meta = {
  title: "Activity/ActivityFeedEntry",
};

export default meta;

type Story = StoryObj;

export const DefaultFallback: Story = {
  render: () => (
    <Box bg="bg" maxW="520px" padding="md">
      <Stack gap="0">
        <ActivityFeedEntry item={extensionItem} />
        <ActivityFeedEntry item={ticketItem} />
      </Stack>
    </Box>
  ),
};
