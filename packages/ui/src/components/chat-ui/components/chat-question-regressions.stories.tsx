import { Box, Button, IconButton, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { PaperclipIcon } from "lucide-react";
import { useState } from "react";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";
import type { QueuedFollowUp } from "./message-types";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Question interruptions",
  component: ChatPanel,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;

const questionPrompt: ChatInputQuestionPrompt = {
  questions: [{ id: "choice", question: "Choose a greeting", options: [{ label: "Hello" }], required: true }],
};

interface QuestionPanelProps {
  prompt?: ChatInputQuestionPrompt;
  queued?: boolean;
  rejectFirst?: boolean;
  draft?: string;
}

function QuestionPanel(props: QuestionPanelProps) {
  const { prompt, queued = false, rejectFirst = false, draft } = props;
  const [rejectNextReply, setRejectNextReply] = useState(rejectFirst);
  const [activePrompt, setActivePrompt] = useState(prompt);
  const [response, setResponse] = useState<ChatInputQuestionResponse>();
  const [items, setItems] = useState<QueuedFollowUp[]>(
    queued ? [{ id: "queued-message", prompt: "Review the release notes", position: 1 }] : [],
  );

  return (
    <Stack w="32rem" gap="sm">
      {queued ? <Button onClick={() => setActivePrompt(questionPrompt)}>Ask a question</Button> : null}
      <Box h="24rem">
        <ChatPanel
          messages={[]}
          emptyStateTitle="Question replies"
          emptyStateDescription="Answer the question or skip it."
          chatInputPlaceholder="Type a message..."
          chatInputDefaultValue={draft}
          attachmentActions={
            <IconButton size="xs" variant="ghost" aria-label="Attach files">
              <PaperclipIcon size={14} />
            </IconButton>
          }
          actions={
            <Button size="xs" variant="ghost">
              gpt-6.1-sol
            </Button>
          }
          queuedFollowUps={items}
          onQueuedFollowUpUpdate={(id, text) => {
            setItems((current) => current.map((item) => (item.id === id ? { ...item, prompt: text } : item)));
          }}
          chatInputQuestionPrompt={activePrompt}
          onSubmitMessage={(_text, _attachments, answer) => {
            if (rejectNextReply) {
              setRejectNextReply(false);
              throw new Error("Question reply failed");
            }
            setResponse(answer);
            setActivePrompt(undefined);
          }}
        />
      </Box>
      <Text as="output" aria-label="Question response">
        {JSON.stringify(response ?? null)}
      </Text>
    </Stack>
  );
}

export const QueuedEditInterruptedByQuestion: Story = {
  render: () => <QuestionPanel queued />,
};

export const QueuedEditRejectedQuestionReply: Story = {
  render: () => <QuestionPanel queued rejectFirst />,
};

export const AttachmentControlsDuringQuestion: Story = {
  render: () => <QuestionPanel prompt={questionPrompt} />,
};

export const DraftSelectionAfterQuestion: Story = {
  tags: ["!manifest"],
  render: () => <QuestionPanel queued draft="Keep my draft" />,
  parameters: {
    docs: {
      description: {
        story:
          "Select part of the draft, ask a question, answer it, then focus the draft. Its text and selection return.",
      },
    },
  },
};

export const InheritedQuestionIds: Story = {
  render: () => (
    <QuestionPanel
      prompt={{
        questions: ["constructor", "__proto__", "toString"].map((id) => ({
          id,
          question: `Answer ${id}`,
          options: [{ label: "Yes" }],
          required: true,
          allowCustomAnswer: true,
        })),
      }}
    />
  ),
};

export const ListedOtherValue: Story = {
  render: () => (
    <QuestionPanel
      prompt={{
        questions: [
          {
            id: "listed-value",
            question: "Choose the listed value",
            options: [{ label: "__pstdio_other__" }],
            required: true,
          },
        ],
      }}
    />
  ),
};

export const ListedOtherValueWithCustomAnswer: Story = {
  render: () => (
    <QuestionPanel
      prompt={{
        questions: [
          {
            id: "listed-value",
            question: "Choose the listed value",
            options: [{ label: "__pstdio_other__" }],
            required: true,
            allowCustomAnswer: true,
          },
        ],
      }}
    />
  ),
};
