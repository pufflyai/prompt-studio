import { Box, Dialog, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { NotificationCenter } from "./notification-center";
import type { NotificationCenterItem } from "./notification-center.types";

const sampleItems: NotificationCenterItem[] = [
  {
    id: "review-1",
    title: "Review generated workspace changes",
    body: "Agent finished a workspace and is waiting for review.",
    priority: "urgent",
    status: "open",
    sourceLabel: "Planner",
    targetLabel: "PS-95",
    timeLabel: "2m ago",
    actions: [{ id: "open", label: "Open", primary: true }],
  },
  {
    id: "blocked-1",
    title: "Resolve blocked package verification",
    body: "Packaged smoke output needs attention before merge.",
    kind: "blocked",
    priority: "high",
    status: "open",
    sourceLabel: "Build",
    targetLabel: "scripts",
    timeLabel: "12m ago",
    actions: [
      { id: "open", label: "Inspect", primary: true },
      { id: "rerun", label: "Rerun" },
    ],
  },
  {
    id: "merge-1",
    title: "Draft PR is ready to merge",
    body: "All required checks passed.",
    priority: "normal",
    status: "read",
    sourceLabel: "GitHub",
    targetLabel: "feature/notifications",
    timeLabel: "1h ago",
    actions: [{ id: "open-pr", label: "Open PR", primary: true }],
  },
  {
    id: "info-1",
    title: "Extension index refreshed",
    priority: "low",
    status: "open",
    sourceLabel: "Extensions",
    timeLabel: "Today",
  },
];

const meta: Meta<typeof NotificationCenter> = {
  title: "Components/Feedback/Notification Center",
  component: NotificationCenter,
  decorators: [
    (Story) => (
      <Box bg="bg" minH="32rem" p="lg">
        <Dialog.Root open modal={false}>
          <Dialog.Positioner alignItems="flex-start" justifyContent="center" p="lg">
            <Dialog.Content maxW="44rem" w="full" p="0" overflow="hidden" borderWidth="1px" borderColor="border.muted">
              <Story />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </Box>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationCenter>;

export const Default: Story = {
  args: {
    items: sampleItems,
    footerStart: (
      <Text textStyle="label/XS" color="fg.muted">
        Enter opens the selected notification
      </Text>
    ),
  },
};

export const SecondaryActions: Story = {
  args: {
    items: [
      {
        id: "proposal-review",
        title: "Review proposal: PS-95",
        priority: "high",
        status: "open",
        actions: [
          { id: "review-proposal", label: "Review proposal", primary: true },
          { id: "approve-proposal", label: "Approve" },
        ],
      },
    ],
  },
};

export const ViewedItems: Story = {
  args: {
    items: [
      {
        id: "new-notification",
        title: "New ticket needs input",
        priority: "high",
        status: "open",
        actions: [{ id: "reply", label: "Reply to agent", primary: true }],
      },
      {
        id: "viewed-notification",
        title: "Viewed merge reminder",
        priority: "normal",
        status: "read",
        actions: [{ id: "open", label: "Open", primary: true }],
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const Loading: Story = {
  args: {
    items: [],
    loading: true,
  },
};

export const ErrorState: Story = {
  args: {
    items: [],
    error: "The notification stream could not be loaded.",
  },
};

export const HighVolume: Story = {
  args: {
    items: Array.from({ length: 80 }, (_, index) => ({
      ...sampleItems[index % sampleItems.length],
      id: `notification-${index}`,
      title: `${sampleItems[index % sampleItems.length].title} ${index + 1}`,
      priority: index % 6 === 0 ? "urgent" : index % 3 === 0 ? "high" : "normal",
    })),
  },
};
