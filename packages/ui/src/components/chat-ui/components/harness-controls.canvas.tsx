import { Button } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";
import { HarnessControls, type HarnessControlsProps } from "./harness-controls";

const meta: CanvasMeta<typeof HarnessControls> = {
  title: "Patterns/Chat/Harness Controls",
  component: HarnessControls,
  args: {
    modes: [],
    onAction: async () => {},
  },
};
export default meta;
type Story = CanvasFrame<typeof HarnessControls>;
const NewConversationComposer = (props: HarnessControlsProps) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(false);
  return (
    <ChatInput
      defaultState={createSerializedPromptState("")}
      onChange={setQuery}
      actions={
        <>
          <Button size="xs" variant="ghost">
            Model
          </Button>
          <HarnessControls
            {...props}
            modes={[]}
            draftTag={
              selected
                ? { label: "Goal", description: `Goal: ${query} · Draft`, onClose: () => setSelected(false) }
                : undefined
            }
          />
        </>
      }
      commands={[
        { name: "/goal", description: "Use this draft as the objective.", onSelect: () => setSelected(true) },
        { name: "/plan", description: "Select native planning.", disabledReason: "Leave the goal first." },
        { name: "/compact", description: "Compact this thread." },
      ]}
    />
  );
};
export const NewConversation: Story = {
  id: "patterns-chat-harness-controls--new-conversation",
  render: (args) => <NewConversationComposer {...args} />,
};
export const IndependentModes: Story = {
  id: "patterns-chat-harness-controls--independent-modes",
  render: (args) => (
    <ChatInput
      defaultState={createSerializedPromptState("Keep this unsent draft")}
      actions={<HarnessControls {...args} />}
    />
  ),
  args: {
    modes: [
      {
        id: "planning",
        label: "Plan",
        description: "Selected for the next turn.",
        state: "Next turn",
        closeActionId: "default",
        actions: [{ id: "default", label: "Leave planning" }],
      },
      {
        id: "goal",
        label: "Goal",
        description: "Finish the migration and verify the result.",
        state: "active · 1200 / 40000 tokens",
        indicator: { label: "Active", tone: "success" },
        tagText: "active: Finish the migration and verify the result.",
        closeActionId: "clear",
        actions: [
          { id: "pause", label: "Pause", icon: "pause" },
          {
            id: "edit",
            label: "Edit",
            icon: "pencil",
            argument: { label: "Objective", value: "Finish the migration" },
          },
          { id: "clear", label: "Clear", icon: "trash-2" },
        ],
      },
    ],
  },
};
export const Pending: Story = {
  id: "patterns-chat-harness-controls--pending",
  args: { ...IndependentModes.args, pending: true },
};
const goalMode = IndependentModes.args?.modes?.find((mode) => mode.id === "goal");
export const PausedGoal: Story = {
  id: "patterns-chat-harness-controls--paused-goal",
  args: {
    modes: goalMode
      ? [
          {
            ...goalMode,
            state: "paused · 1200 / 40000 tokens",
            indicator: { label: "Paused", tone: "warning" },
            actions: [
              { id: "resume", label: "Resume", icon: "play" },
              ...goalMode.actions.filter((action) => action.id !== "pause"),
            ],
          },
        ]
      : [],
  },
};
export const CompletedGoal: Story = {
  id: "patterns-chat-harness-controls--completed-goal",
  args: {
    modes: goalMode
      ? [{ ...goalMode, state: "complete · 1200 / 40000 tokens", indicator: { label: "Complete", tone: "info" } }]
      : [],
  },
};
export const StatusUnavailable: Story = {
  id: "patterns-chat-harness-controls--status-unavailable",
  args: { ...IndependentModes.args, unavailable: true },
};
export const SentReference: Story = {
  id: "patterns-chat-harness-controls--sent-reference",
  args: {
    sentTag: {
      label: "Goal",
      description: "Finish the release notes · Native status is not confirmed. Closing hides this reference only.",
      onClose: () => {},
    },
  },
};
export const NativeError: Story = {
  id: "patterns-chat-harness-controls--native-error",
  render: (args) => (
    <>
      <AlertMessage status="error" title="Command not sent">
        This harness does not support this command. Your draft is ready to edit.
      </AlertMessage>
      <HarnessControls {...args} />
    </>
  ),
};
