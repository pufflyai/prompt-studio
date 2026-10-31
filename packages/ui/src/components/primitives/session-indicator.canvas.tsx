import { HStack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { SessionIndicator, sessionCompletionStatuses } from "@/components/primitives/session-indicator";

const meta: CanvasMeta<typeof SessionIndicator> = {
  title: "Components/Feedback/Session Indicator",
  component: SessionIndicator,
};
export default meta;
type Story = CanvasFrame<typeof SessionIndicator>;
export const InProgress: Story = {
  id: "components-feedback-session-indicator--in-progress",
  args: { status: "in_progress" },
};
export const MutedInProgress: Story = {
  id: "components-feedback-session-indicator--muted-in-progress",
  args: { status: "in_progress", color: "fg.muted" },
};
export const AwaitingInput: Story = {
  id: "components-feedback-session-indicator--awaiting-input",
  args: { status: "awaiting_input" },
};
export const Queued: Story = {
  id: "components-feedback-session-indicator--queued",
  args: { status: "queued" },
};
export const Completed: Story = {
  id: "components-feedback-session-indicator--completed",
  args: { status: "completed" },
};
export const Failed: Story = {
  id: "components-feedback-session-indicator--failed",
  args: { status: "failed" },
};
export const Cancelled: Story = {
  id: "components-feedback-session-indicator--cancelled",
  args: { status: "cancelled" },
};
export const Disconnected: Story = {
  id: "components-feedback-session-indicator--disconnected",
  args: { status: "disconnected" },
};
export const Undefined: Story = {
  id: "components-feedback-session-indicator--undefined",
  args: {},
};
export const AllStatuses: Story = {
  id: "components-feedback-session-indicator--all-statuses",
  render: () => (
    <HStack gap="md">
      {[...sessionCompletionStatuses, undefined].map((status) => (
        <HStack key={status ?? "undefined"} gap="xs">
          <SessionIndicator status={status} />
          <Text textStyle="label/S/regular">{status ?? "undefined"}</Text>
        </HStack>
      ))}
    </HStack>
  ),
};
