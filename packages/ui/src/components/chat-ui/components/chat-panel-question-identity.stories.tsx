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
