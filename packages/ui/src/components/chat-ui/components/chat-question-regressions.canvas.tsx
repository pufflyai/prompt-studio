import { Box, Button, IconButton, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { PaperclipIcon } from "lucide-react";
import { useState } from "react";
import type { ChatInputQuestionPrompt, ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";
import type { QueuedFollowUp } from "./message-types";

const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Patterns/Chat/Question interruptions",
  component: ChatPanel,
};
export default meta;
type Story = CanvasFrame<typeof ChatPanel>;
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
  id: "patterns-chat-question-interruptions--queued-edit-interrupted-by-question",
  render: () => <QuestionPanel queued />,
};
export const QueuedEditRejectedQuestionReply: Story = {
  id: "patterns-chat-question-interruptions--queued-edit-rejected-question-reply",
  render: () => <QuestionPanel queued rejectFirst />,
};
export const AttachmentControlsDuringQuestion: Story = {
  id: "patterns-chat-question-interruptions--attachment-controls-during-question",
  render: () => <QuestionPanel prompt={questionPrompt} />,
};
export const DraftSelectionAfterQuestion: Story = {
  id: "patterns-chat-question-interruptions--draft-selection-after-question",
  render: () => <QuestionPanel queued draft="Keep my draft" />,
  description:
    "Select part of the draft, ask a question, answer it, then focus the draft. Its text and selection return.",
};
export const InheritedQuestionIds: Story = {
  id: "patterns-chat-question-interruptions--inherited-question-ids",
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
  id: "patterns-chat-question-interruptions--listed-other-value",
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
  id: "patterns-chat-question-interruptions--listed-other-value-with-custom-answer",
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
