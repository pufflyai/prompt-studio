import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const meta: Meta<typeof ChatPanel> = { title: "Chat/ChatPanel/Async questions", component: ChatPanel };
export default meta;
type Story = StoryObj<typeof ChatPanel>;

const request = (callId: string, questions: Array<{ question: string; options: string[] }>): SessionMessage => ({
  id: callId,
  role: "assistant",
  parts: [
    {
      type: "tool",
      tool: "question",
      callId,
      status: "pending",
      state: {
        input: {
          delivery: "async",
          questions: questions.map((question, index) => ({
            ...question,
            id: `${callId}-${index}`,
            allowCustomAnswer: true,
          })),
        },
      },
    },
  ],
});
const initialMessages: SessionMessage[] = [
  { id: "user", role: "user", parts: [{ type: "text", text: "Prepare the release notes. Ask while you work." }] },
  request("first", [
    { question: "Which validation should I run?", options: ["Browser checks", "Targeted tests"] },
    { question: "Who is it for?", options: [] },
  ]),
  request("second", [
    { question: "Which files should I include?", options: ["Release notes only", "All changed files"] },
  ]),
  {
    id: "progress",
    role: "assistant",
    parts: [{ type: "text", text: "I can review the changed files while you choose." }],
  },
];

const longQuestionMessages = [
  initialMessages[0],
  request("long", [
    {
      question:
        "Should I validate the full release workflow in the browser, including onboarding, selecting a project, opening a session, submitting an async answer, and restoring the draft and attachments afterward? Or should I only run the targeted tests for the changed question controls before preparing the pull request?",
      options: ["Browser checks", "Targeted tests"],
    },
    { question: "Which color?", options: ["Blue", "Green"] },
    { question: "Which environment?\nChoose one.", options: ["Local", "CI"] },
  ]),
  initialMessages[3],
];

function AsyncQuestions(props: { decision?: boolean; terminal?: boolean; long?: boolean }) {
  const { decision, terminal, long } = props;
  const [messages, setMessages] = useState(() => {
    if (long) return longQuestionMessages;
    return terminal ? initialMessages.slice(0, 2) : initialMessages;
  });
  const [lastReply, setLastReply] = useState("");
  const [failNext, setFailNext] = useState(false);
  return (
    <Stack height="700px" gap="md">
      <HStack>
        <Button onClick={() => setFailNext(true)}>Reject next answer</Button>
        <Button
          onClick={() =>
            setMessages((current) => [
              ...current,
              request(`request-${current.length}`, [
                { question: "Which language?", options: ["TypeScript", "Python"] },
              ]),
            ])
          }
        >
          Ask another
        </Button>
      </HStack>
      <Text>{lastReply}</Text>
      <Box flex="1" minHeight="0">
        <ChatPanel
          conversationKey="async-questions"
          messages={messages}
          streaming={!terminal}
          emptyStateTitle="Release workflow"
          emptyStateDescription=""
          chatInputPlaceholder="Message the agent..."
          chatInputDefaultValue="Keep this unsent release draft"
          attachedResources={["release-notes.md"]}
          attachmentList={<Text>release-notes.md</Text>}
          composerDecision={
            decision
              ? {
                  id: "plan-approval",
                  model: "gpt-6.1-sol",
                  actions: [{ id: "approve", label: "Approve and implement", variant: "primary" }],
                  onAction: async () => {},
                }
              : undefined
          }
          onSubmitMessage={async (_text, attachments, response) => {
            if (!response) return;
            if (attachments.length) throw Error("Question answers must not include draft attachments");
            if (failNext) {
              setFailNext(false);
              throw Error("The provider rejected the answer");
            }
            setLastReply(JSON.stringify(response));
            setMessages((current) =>
              current.map((message) => ({
                ...message,
                parts: message.parts.map((part) =>
                  part.type === "tool" && part.callId === response.callId
                    ? { ...part, status: "completed", state: { ...part.state, output: { answers: response.answers } } }
                    : part,
                ),
              })),
            );
          }}
        />
      </Box>
    </Stack>
  );
}

export const PendingAndAnswered: Story = { render: () => <AsyncQuestions /> };
export const WithPlanDecision: Story = { render: () => <AsyncQuestions decision /> };
export const QuestionOnlyTail: Story = { render: () => <AsyncQuestions terminal /> };
export const LongMultilineQuestion: Story = { render: () => <AsyncQuestions long /> };
