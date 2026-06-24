import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta } from "@storybook/react";
import type { ReactNode } from "react";
import { NotificationRow } from "./notification-row";
import type { NotificationItem, NotificationKind, NotificationPriority } from "./notification-types";

type StoryFn = () => ReactNode;

const meta: Meta<typeof NotificationRow> = {
  title: "Components/Notifications/Row",
  component: NotificationRow,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="md" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

const KINDS: NotificationKind[] = ["needs_review", "ready_to_merge", "blocked", "approval_required", "failed", "info"];
const PRIORITIES: NotificationPriority[] = ["low", "normal", "high", "urgent"];

const makeItem = (kind: NotificationKind, priority: NotificationPriority): NotificationItem => ({
  id: `${kind}-${priority}`,
  title: `${kind.replace("_", " ")} sample title`,
  body: "Short description of what needs attention.",
  kind,
  status: "open",
  priority,
  sourceLabel: "Planner",
  resourceLabel: "PS-99",
  updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  actions: [{ id: "primary", label: "Open", kind: "open-resource", primary: true }],
});

export const Matrix = {
  render: () => (
    <SimpleGrid columns={1} gap="md">
      {KINDS.map((kind) => (
        <Stack key={kind} gap="2">
          <Text textStyle="heading/S">{kind}</Text>
          {PRIORITIES.map((priority) => (
            <NotificationRow key={priority} item={makeItem(kind, priority)} onInvokeAction={() => {}} />
          ))}
        </Stack>
      ))}
    </SimpleGrid>
  ),
};

export const Active = {
  render: () => (
    <Stack maxWidth="640px">
      <NotificationRow item={makeItem("needs_review", "normal")} active onInvokeAction={() => {}} />
    </Stack>
  ),
};
