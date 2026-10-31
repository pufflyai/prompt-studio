import { Box, Button, Input, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";

const ComposerFallbackStory = (props: ChatPanelProps) => {
  const [unavailable, setUnavailable] = useState(true);
  const [draft, setDraft] = useState("Keep this unsent draft.");
  return (
    <Stack h="lg">
      <Button size="sm" onClick={() => setUnavailable((value) => !value)}>
        Toggle messaging availability
      </Button>
      <Box flex="1" minH="0">
        <ChatPanel
          {...props}
          chatInputDefaultValue={draft}
          onChatInputChange={setDraft}
          composerFallback={
            unavailable ? <AlertMessage status="warning" title="Messaging is unavailable" /> : undefined
          }
          submitDisabled={unavailable || props.submitDisabled}
        />
      </Box>
    </Stack>
  );
};
const meta = {
  title: "Patterns/Chat/Composer Fallback",
  component: ChatPanel,
  render: (args) => <ComposerFallbackStory {...args} />,
  args: {
    messages: [
      { id: "reply", role: "assistant", parts: [{ type: "text", text: "The saved conversation stays visible." }] },
    ],
    emptyStateTitle: "Conversation",
    emptyStateDescription: "",
    chatInputPlaceholder: "Reply...",
    actions: <Button size="xs">Message settings</Button>,
    attachmentActions: <Button size="xs">Upload files</Button>,
    workspaceHub: <Button size="xs">Select workspace</Button>,
  },
} satisfies CanvasMeta<typeof ChatPanel>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RetainedDraft: Story = {
  id: "patterns-chat-composer-fallback--retained-draft",
};
export const Dark: Story = {
  id: "patterns-chat-composer-fallback--dark",
};
export const RetainedQueuedEdit: Story = {
  id: "patterns-chat-composer-fallback--retained-queued-edit",
  args: {
    queuedFollowUps: [{ id: "queued", prompt: "Review the changes.", position: 1 }],
    onQueuedFollowUpUpdate: () => {},
  },
};
export const RetainedQuestionAnswers: Story = {
  id: "patterns-chat-composer-fallback--retained-question-answers",
  args: {
    chatInputQuestionPrompt: {
      callId: "release-checks",
      questions: [
        {
          id: "validation",
          question: "Which checks should I run?",
          multiple: true,
          allowCustomAnswer: true,
          options: [{ label: "Targeted tests" }],
        },
      ],
    },
    queuedFollowUps: [{ id: "queued", prompt: "Review the release notes.", position: 1 }],
    onSubmitMessage: () => {},
  },
};
export const RetainedConfirmation: Story = {
  id: "patterns-chat-composer-fallback--retained-confirmation",
  args: {
    composerDecision: {
      id: "release-approval",
      controls: <Input aria-label="Approval note" size="sm" />,
      actions: [{ id: "approve", label: "Approve and implement", variant: "primary" }],
      onAction: () => {},
    },
  },
};
