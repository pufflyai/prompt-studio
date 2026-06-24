import { Box } from "@chakra-ui/react";
import type { Meta } from "@storybook/react";
import type { ReactNode } from "react";
import { NotificationModal, type NotificationModalProps } from "./notification-modal";
import type { NotificationItem } from "./notification-types";

type StoryFn = () => ReactNode;

const meta: Meta<typeof NotificationModal> = {
  title: "Components/Notifications/Modal",
  component: NotificationModal,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="md" background="bg" minHeight="80vh">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

const sample: NotificationItem[] = [
  {
    id: "n1",
    title: "Ticket proposal refined",
    body: "Review the refined proposal for PS-42 before implementation starts.",
    kind: "needs_review",
    status: "open",
    priority: "normal",
    sourceLabel: "Planner",
    resourceLabel: "PS-42",
    updatedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    actions: [
      { id: "review", label: "Review proposal", kind: "open-resource", primary: true },
      { id: "approve", label: "Approve", kind: "command" },
    ],
  },
  {
    id: "n2",
    title: "Ticket ready for merge",
    body: null,
    kind: "ready_to_merge",
    status: "open",
    priority: "normal",
    sourceLabel: "Planner",
    resourceLabel: "PS-37",
    updatedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    actions: [{ id: "open", label: "Open workspace", kind: "open-resource", primary: true }],
  },
  {
    id: "n3",
    title: "Need your input",
    body: "The agent is paused waiting for guidance.",
    kind: "blocked",
    status: "open",
    priority: "high",
    sourceLabel: "Planner",
    resourceLabel: "PS-51",
    updatedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    actions: [{ id: "reply", label: "Reply", kind: "open-resource", primary: true }],
  },
];

const noop = () => {};

export const Default = {
  render: () => <NotificationModal open items={sample} onClose={noop} onInvokeAction={noop} />,
};

export const Empty = {
  render: () => <NotificationModal open items={[]} onClose={noop} onInvokeAction={noop} />,
};

export const WithCustomEmpty = {
  render: () => (
    <NotificationModal
      open
      items={[]}
      emptyTitle="Nothing waiting"
      emptyDescription="Agents are working — you'll hear back when there is something to decide."
      onClose={noop}
      onInvokeAction={noop}
    />
  ),
};

export const Snoozed = {
  render: () => (
    <NotificationModal
      open
      items={[
        {
          ...sample[0],
          status: "snoozed",
          snoozedUntil: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
      ]}
      onClose={noop}
      onInvokeAction={noop}
    />
  ),
};

export const FromProps = {
  render: (args: NotificationModalProps) => <NotificationModal {...args} />,
  args: { open: true, items: sample, onClose: noop, onInvokeAction: noop },
};
