import { HStack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { SessionIndicator, sessionCompletionStatuses } from "@/components/primitives/session-indicator";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

const meta: CanvasMeta<typeof SessionIndicator> = {
  title: "Design system/Components/Feedback/Session indicator",
  component: SessionIndicator,
};
export default {
  title: "Design system/Components/Feedback/Session indicator",
  fullscreen: true,
};
type Story = CanvasFrame<typeof SessionIndicator>;
const InProgress: Story = {
  id: "components-feedback-session-indicator--in-progress",
  args: { status: "in_progress" },
};
const MutedInProgress: Story = {
  id: "components-feedback-session-indicator--muted-in-progress",
  args: { status: "in_progress", color: "fg.muted" },
};
const AwaitingInput: Story = {
  id: "components-feedback-session-indicator--awaiting-input",
  args: { status: "awaiting_input" },
};
const Queued: Story = {
  id: "components-feedback-session-indicator--queued",
  args: { status: "queued" },
};
const Completed: Story = {
  id: "components-feedback-session-indicator--completed",
  args: { status: "completed" },
};
const Failed: Story = {
  id: "components-feedback-session-indicator--failed",
  args: { status: "failed" },
};
const Cancelled: Story = {
  id: "components-feedback-session-indicator--cancelled",
  args: { status: "cancelled" },
};
const Disconnected: Story = {
  id: "components-feedback-session-indicator--disconnected",
  args: { status: "disconnected" },
};
const Undefined: Story = {
  id: "components-feedback-session-indicator--undefined",
  args: {},
};
const AllStatuses: Story = {
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

const Examples = createCanvasExampleNavigator(meta, {
  InProgress,
  MutedInProgress,
  AwaitingInput,
  Queued,
  Completed,
  Failed,
  Cancelled,
  Disconnected,
  Undefined,
  AllStatuses,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as InProgress };
