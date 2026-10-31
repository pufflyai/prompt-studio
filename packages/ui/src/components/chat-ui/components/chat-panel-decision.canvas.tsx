import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";
import { HarnessControls } from "./harness-controls";

const PlanDecision = (props: ChatPanelProps) => {
  const [dismissed, setDismissed] = useState(false);
  const controls = (
    <HarnessControls
      modes={[
        {
          id: "planning",
          label: "Plan",
          description: "Release workflow",
          state: "Awaiting approval",
          confirmation: { id: "proposal", title: "Approve plan", actionId: "implement" },
          actions: [{ id: "implement", label: "Approve and implement" }],
        },
      ]}
      onAction={async () => {}}
      onRequestConfirmation={() => setDismissed(false)}
    />
  );
  return (
    <ChatPanel
      {...props}
      actions={controls}
      composerDecision={
        dismissed || !props.composerDecision
          ? undefined
          : {
              ...props.composerDecision,
              controls,
              onAction: async (action) => {
                await props.composerDecision?.onAction(action);
                setDismissed(true);
              },
            }
      }
    />
  );
};
const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Patterns/Chat/Composer Decision",
  component: ChatPanel,
  render: (args) => <PlanDecision {...args} />,
  args: {
    messages: [
      {
        id: "plan",
        role: "assistant",
        parts: [{ type: "text", text: "# Release workflow\n\n1. Update shared controls.\n2. Validate native state." }],
      },
    ],
    chatInputDefaultValue: "Keep this unsent draft",
    chatInputPlaceholder: "Reply to the agent...",
    emptyStateTitle: "Conversation",
    emptyStateDescription: "",
    onSubmitMessage: () => {},
    composerDecision: {
      id: "proposal",
      model: "gpt-5.5",
      actions: [
        { id: "skip", label: "Skip", variant: "ghost" },
        { id: "continue", label: "Continue planning", variant: "subtle" },
        { id: "approve", label: "Approve and implement", variant: "primary" },
      ],
      onAction: () => {},
    },
  },
};
export default meta;
type Story = CanvasFrame<typeof ChatPanel>;
export const PlanApproval: Story = {
  id: "patterns-chat-composer-decision--plan-approval",
};
export const Unavailable: Story = {
  id: "patterns-chat-composer-decision--unavailable",
  args: {
    composerDecision: {
      ...meta.args!.composerDecision!,
      actions: meta.args!.composerDecision!.actions.map((action) => ({ ...action, disabled: action.id === "approve" })),
    },
  },
};
export const Pending: Story = {
  id: "patterns-chat-composer-decision--pending",
  args: { composerDecision: { ...meta.args!.composerDecision!, pending: true } },
};
export const QueuedEdit: Story = {
  id: "patterns-chat-composer-decision--queued-edit",
  args: { queuedFollowUps: [{ id: "queued", prompt: "Keep this queued edit" }], onQueuedFollowUpUpdate: () => {} },
};
export const Failed: Story = {
  id: "patterns-chat-composer-decision--failed",
  args: {
    composerDecision: {
      ...meta.args!.composerDecision!,
      onAction: async () => {
        throw Error("Provider unavailable");
      },
    },
  },
};
export const NativeQuestionFirst: Story = {
  id: "patterns-chat-composer-decision--native-question-first",
  args: {
    messages: [
      ...meta.args!.messages!,
      {
        id: "question",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "question",
            callId: "native-question",
            status: "pending",
            state: {
              input: {
                questions: [{ question: "Which validation?", options: [{ label: "Browser" }, { label: "Native" }] }],
              },
            },
          },
        ],
      },
    ],
  },
};
