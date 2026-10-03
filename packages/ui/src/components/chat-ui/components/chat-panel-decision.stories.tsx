import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";
import { HarnessControls } from "./harness-controls";

const PlanDecision = (props: ChatPanelProps) => {
  const [dismissed, setDismissed] = useState(false);
  return (
    <ChatPanel
      {...props}
      actions={
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
      }
      composerDecision={
        dismissed || !props.composerDecision
          ? undefined
          : {
              ...props.composerDecision,
              onRespond: async (response) => {
                await props.composerDecision?.onRespond(response);
                setDismissed(true);
              },
            }
      }
    />
  );
};

const meta: Meta<typeof ChatPanel> = {
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
    onSubmitMessage: fn(),
    composerDecision: {
      prompt: {
        callId: "proposal",
        questions: [
          {
            id: "proposal",
            question: "Approve plan",
            required: true,
            allowCustomAnswer: false,
            options: [{ label: "Approve and implement" }, { label: "Keep planning" }],
          },
        ],
      },
      onRespond: fn(),
    },
  },
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;
export const PlanApproval: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("radio", { name: "Approve and implement" })).toBeVisible();
    await userEvent.click(c.getByRole("radio", { name: "Keep planning" }));
    await userEvent.click(c.getByTestId("send-message-button"));
    await expect(c.getByRole("textbox")).toHaveTextContent("Keep this unsent draft");
    await userEvent.click(c.getByRole("button", { name: "Plan details" }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("button", { name: "Approve and implement" }),
    );
    await expect(c.getByRole("radio", { name: "Approve and implement" })).toBeVisible();
  },
};
export const Unavailable: Story = {
  args: {
    composerDecision: {
      ...meta.args!.composerDecision!,
      canRespond: (response) => response.answers[0]?.[0] === "Keep planning",
    },
  },
};
export const Pending: Story = { args: { composerDecision: { ...meta.args!.composerDecision!, pending: true } } };
export const QueuedEdit: Story = {
  args: { queuedFollowUps: [{ id: "queued", prompt: "Keep this queued edit" }], onQueuedFollowUpUpdate: fn() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued follow-up" }));
    await userEvent.click(c.getByRole("radio", { name: "Keep planning" }));
    await expect(c.getByTestId("send-message-button")).not.toHaveAttribute("title", "Save queued follow-up");
    await userEvent.click(c.getByTestId("send-message-button"));
    await expect(c.getByRole("textbox")).toHaveTextContent("Keep this queued edit");
    await expect(args.onQueuedFollowUpUpdate).not.toHaveBeenCalled();
  },
};
export const Failed: Story = {
  args: {
    composerDecision: {
      ...meta.args!.composerDecision!,
      onRespond: async () => {
        throw Error("Provider unavailable");
      },
    },
  },
};
export const NativeQuestionFirst: Story = {
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
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("radio", { name: "Browser" })).toBeVisible();
  },
};
