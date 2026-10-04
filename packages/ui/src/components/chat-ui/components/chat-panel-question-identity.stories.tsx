import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChatInputQuestionResponse } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";

const meta: Meta<typeof ChatPanel> = { title: "Chat/ChatPanel/Question identity", component: ChatPanel };
export default meta;
type Story = StoryObj<typeof ChatPanel>;

function RepeatedQuestion() {
  const [request, setRequest] = useState(1);
  const [submitted, setSubmitted] = useState<ChatInputQuestionResponse>();
  return (
    <Stack height="600px" gap="md">
      <Button
        onClick={() => {
          setRequest((current) => current + 1);
          setSubmitted(undefined);
        }}
      >
        Ask again
      </Button>
      <Text>{submitted ? JSON.stringify(submitted) : `Request ${request}`}</Text>
      <Box flex="1" minHeight="0">
        <ChatPanel
          messages={[]}
          streaming={false}
          emptyStateTitle="Choose an audience"
          emptyStateDescription="Each request has its own question identity."
          chatInputPlaceholder="Answer the question..."
          chatInputQuestionPrompt={{
            callId: `request-${request}`,
            questions: [
              { id: "audience", question: "Who is it for?", options: [], required: true, allowCustomAnswer: true },
            ],
          }}
          onSubmitMessage={async (_text, _attachments, response) => {
            setSubmitted(response);
          }}
        />
      </Box>
    </Stack>
  );
}

export const RepeatedRequest: Story = { render: () => <RepeatedQuestion /> };

function AsyncQuestions() {
  const [messages, setMessages] = useState<import("./message-types").SessionMessage[]>([]);
  const ask = (callId: string, question: string, options: string[]) =>
    setMessages((current) => [
      ...current,
      {
        id: callId,
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "question",
            callId,
            status: "pending",
            state: { input: { questions: [{ question, options, custom: true }] } },
          },
        ],
      },
    ]);
  return (
    <Stack h="600px" gap="md">
      <Stack direction="row">
        <Button onClick={() => ask("first", "Which language?", ["TypeScript", "Python"])}>Ask first</Button>
        <Button onClick={() => ask("second", "Which validation?", ["Browser", "Native"])}>Ask another</Button>
      </Stack>
      <ChatPanel
        messages={messages}
        emptyStateTitle="Release workflow"
        emptyStateDescription=""
        chatInputDefaultValue="Keep this unsent draft"
        attachedResources={["draft.txt"]}
        attachmentList={<Text>draft.txt</Text>}
        onSubmitMessage={async (_text, attachments, response) => {
          if (attachments.length) throw Error("A question answer must not contain draft files");
          setMessages((current) =>
            current.map((message) => ({
              ...message,
              parts: message.parts.map((part) =>
                part.type === "tool" && part.callId === response?.callId
                  ? { ...part, status: "completed", state: { ...part.state, metadata: { answers: response.answers } } }
                  : part,
              ),
            })),
          );
        }}
      />
    </Stack>
  );
}

export const QueuedRequests: Story = { render: () => <AsyncQuestions /> };
