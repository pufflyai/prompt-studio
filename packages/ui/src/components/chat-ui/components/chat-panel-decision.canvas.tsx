import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
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
      id: "proposal",
      model: "gpt-5.5",
      actions: [
        { id: "skip", label: "Skip", variant: "ghost" },
        { id: "continue", label: "Continue planning", variant: "subtle" },
        { id: "approve", label: "Approve and implement", variant: "primary" },
      ],
      onAction: fn(),
    },
  },
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;
export const PlanApproval: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByLabelText("Plan decision")).toBeVisible();
    await userEvent.click(c.getByRole("button", { name: "Continue planning", exact: true }));
    await expect(
      canvasElement.querySelector<HTMLElement>('[role="textbox"][contenteditable="true"]')!,
    ).toHaveTextContent("Keep this unsent draft");
    await userEvent.click(c.getByRole("button", { name: "Plan details" }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("button", {
        name: "Approve and implement",
        exact: true,
      }),
    );
    await expect(c.getByLabelText("Plan decision")).toBeVisible();
  },
};
export const Unavailable: Story = {
  args: {
    composerDecision: {
      ...meta.args!.composerDecision!,
      actions: meta.args!.composerDecision!.actions.map((action) => ({ ...action, disabled: action.id === "approve" })),
    },
  },
};
export const Pending: Story = { args: { composerDecision: { ...meta.args!.composerDecision!, pending: true } } };
export const QueuedEdit: Story = {
  args: { queuedFollowUps: [{ id: "queued", prompt: "Keep this queued edit" }], onQueuedFollowUpUpdate: fn() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /^Edit queued message:/ }));
    await userEvent.click(c.getByRole("button", { name: "Continue planning", exact: true }));
    await expect(
      canvasElement.querySelector<HTMLElement>('[role="textbox"][contenteditable="true"]')!,
    ).toHaveTextContent("Keep this queued edit");
    await expect(args.onQueuedFollowUpUpdate).not.toHaveBeenCalled();
  },
};
export const Failed: Story = {
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
    await expect(within(canvasElement).getByRole("radio", { name: "Browser" })).toBeVisible();
  },
};
